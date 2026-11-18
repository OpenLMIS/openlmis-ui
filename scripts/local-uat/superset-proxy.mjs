// Development-only Superset proxy: a separate local origin that frames UAT's Superset as a guest.
import http from 'node:http';
import https from 'node:https';
import { allowFrameAncestor, localRedirect, safePath, supersetDecision } from './guards.mjs';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
]);
// Credentials and caller-chosen routing never reach Superset; X-GuestToken does.
const DROPPED = new Set([
  'host',
  'cookie',
  'authorization',
  'forwarded',
  'x-real-ip',
  'origin',
  'referer',
]);

const deny = (response, status, message) => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify({ message }));
};

/** Maps a known local Origin/Referer to its UAT counterpart; anything else is dropped. */
function mapOrigin(value, { localOrigin, upstreamOrigin, uiOrigin, upstreamUiOrigin }, keepPath) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  const target =
    url.origin === localOrigin ? upstreamOrigin : url.origin === uiOrigin ? upstreamUiOrigin : null;
  if (!target) return undefined;
  return keepPath && url.origin === localOrigin
    ? `${target}${url.pathname}${url.search}`
    : `${target}/`;
}

/**
 * @param {{ upstream: string, localOrigin: string, uiOrigin: string, upstreamUiOrigin: string,
 *   log?: (line: string) => void }} options
 */
export function createSupersetProxy({ upstream, localOrigin, uiOrigin, upstreamUiOrigin, log }) {
  const upstreamUrl = new URL(upstream);
  const upstreamOrigin = upstreamUrl.origin;
  const local = new URL(localOrigin);
  if (local.origin === new URL(uiOrigin).origin)
    throw new Error('The Superset proxy needs an origin of its own, apart from the UI.');
  const allowedHosts = new Set([local.host, `127.0.0.1:${local.port}`]);
  const transport = upstreamUrl.protocol === 'https:' ? https : http;
  const agent = new transport.Agent({ keepAlive: true });
  const origins = { localOrigin: local.origin, upstreamOrigin, uiOrigin, upstreamUiOrigin };
  const note = (method, rawUrl, status) =>
    log?.(`${method} ${safePath(rawUrl) ?? '(refused path)'} ${status}`);

  return http.createServer((request, response) => {
    const { method = 'GET', url: rawUrl = '/' } = request;
    if (!allowedHosts.has(request.headers.host ?? '')) {
      note(method, rawUrl, 421);
      return deny(response, 421, 'Unexpected host for the local Superset proxy.');
    }
    const decision = supersetDecision(method, rawUrl, request.headers);
    if (decision === 'deny') {
      note(method, rawUrl, 405);
      request.resume();
      return deny(response, 405, 'The local Superset proxy only allows reads and chart queries.');
    }
    if (decision === 'local-telemetry') {
      request.resume();
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return response.end('{}');
    }

    const headers = {};
    for (const [name, value] of Object.entries(request.headers)) {
      if (HOP_BY_HOP.has(name) || DROPPED.has(name) || name.startsWith('x-forwarded-')) continue;
      headers[name] = value;
    }
    headers.host = upstreamUrl.host;
    const origin = request.headers.origin && mapOrigin(request.headers.origin, origins, false);
    if (origin) headers.origin = origin.replace(/\/$/, '');
    const referer = request.headers.referer && mapOrigin(request.headers.referer, origins, true);
    if (referer) headers.referer = referer;

    const outgoing = transport.request(
      {
        protocol: upstreamUrl.protocol,
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port || undefined,
        servername: upstreamUrl.hostname,
        method,
        path: rawUrl,
        headers,
        agent,
      },
      (answer) => {
        const out = {};
        for (const [name, value] of Object.entries(answer.headers)) {
          if (HOP_BY_HOP.has(name) || name === 'set-cookie' || name === 'x-frame-options') continue;
          out[name] = value;
        }
        out['content-security-policy'] = allowFrameAncestor(
          answer.headers['content-security-policy'],
          uiOrigin,
        );
        if (answer.headers.location) {
          const location = localRedirect(answer.headers.location, upstreamOrigin, local.origin);
          if (!location) {
            answer.resume();
            note(method, rawUrl, 502);
            return deny(response, 502, 'Superset redirected outside the proxied origin.');
          }
          out.location = location;
        }
        note(method, rawUrl, answer.statusCode);
        response.writeHead(answer.statusCode ?? 502, out);
        answer.pipe(response);
      },
    );
    outgoing.on('error', () => {
      note(method, rawUrl, 502);
      if (!response.headersSent) deny(response, 502, 'Superset could not be reached.');
      else response.destroy();
    });
    request.pipe(outgoing);
  });
}
