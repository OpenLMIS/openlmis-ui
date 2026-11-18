// Development-only Vite plugin for the local UAT launcher: read-only API proxy and a config overlay.
import { readFile } from 'node:fs/promises';
import { apiDecision, safePath } from './guards.mjs';

const GUEST_TOKEN = '/api/reports/superset/guest-token';

const json = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
};

/** Keeps guest tokens out of every cache on their way through the local proxy. */
export function noStoreGuestTokens(proxy) {
  proxy.on('proxyRes', (answer, request) => {
    if (safePath(request.url ?? '') === GUEST_TOKEN) answer.headers['cache-control'] = 'no-store';
  });
}

/**
 * @param {{ supersetOrigin: string, log?: (line: string) => void }} options
 */
export function localUatGuard({ supersetOrigin, log }) {
  let base = '/';
  return {
    name: 'local-uat-guard',
    configResolved(config) {
      base = config.base;
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const rawUrl = request.url ?? '/';
        const method = request.method ?? 'GET';
        if (rawUrl === `${base}config.json` || rawUrl.startsWith(`${base}config.json?`)) {
          let deployed = {};
          try {
            deployed = JSON.parse(await readFile('public/config.json', 'utf8'));
          } catch {}
          return json(response, 200, {
            ...deployed,
            supersetUrl: supersetOrigin,
            featureFlags: { ...deployed.featureFlags, NATIVE_DASHBOARDS: true },
          });
        }
        if (!/^\/(api|localeSettings)(\/|\?|$)/.test(rawUrl)) return next();
        const decision = apiDecision(method, rawUrl, request.headers);
        if (decision === 'forward') return next();
        request.resume();
        if (decision === 'local-logout') return json(response, 200, {});
        log?.(`${method} ${safePath(rawUrl) ?? '(refused path)'} 405`);
        return json(response, 405, {
          message: 'The local UAT proxy only allows reads and sign-in.',
        });
      });
    },
  };
}
