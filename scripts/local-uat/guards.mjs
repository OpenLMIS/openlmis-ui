// Development-only request decisions for the local UAT proxies. Never imported by the app.

const READS = new Set(['GET', 'HEAD']);

/** The parsed path, or null when it is ambiguous enough to slip past an exact match. */
export function safePath(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.startsWith('/')) return null;
  const path = rawUrl.split(/[?#]/, 1)[0];
  if (/\\|%|;|\/\/|(^|\/)\.\.?(\/|$)/.test(path)) return null;
  return path;
}

/** OpenLMIS API: reads and password sign-in reach UAT; sign-out stays local; the rest is refused. */
export function apiDecision(method, rawUrl, headers = {}) {
  const path = safePath(rawUrl);
  if (!path || headers['x-http-method-override'] || headers['x-method-override']) return 'deny';
  if (!/^\/(api|localeSettings)(\/|$)/.test(path)) return 'deny';
  if (READS.has(method)) return /^\/api\/orders\/[^/]+\/retry\/?$/.test(path) ? 'deny' : 'forward';
  if (method === 'POST' && path === '/api/users/auth/logout') return 'local-logout';
  if (method === 'POST' && path === '/api/oauth/token') {
    const query = new URLSearchParams(rawUrl.slice(rawUrl.indexOf('?') + 1));
    const exact =
      rawUrl.includes('?') &&
      [...query.keys()].join() === 'grant_type' &&
      query.get('grant_type') === 'password';
    return exact ? 'forward' : 'deny';
  }
  return 'deny';
}

const TELEMETRY = new Set(['/superset/log/', '/api/v1/log/']);

/** Superset: reads and chart-data queries reach UAT; telemetry is answered locally; the rest is refused. */
export function supersetDecision(method, rawUrl, headers = {}) {
  const path = safePath(rawUrl);
  if (!path || headers['x-http-method-override'] || headers['x-method-override']) return 'deny';
  if (READS.has(method)) return 'forward';
  if (method === 'POST' && path === '/api/v1/chart/data') return 'forward';
  if (method === 'POST' && TELEMETRY.has(path)) return 'local-telemetry';
  return 'deny';
}

/** Replaces only `frame-ancestors`, so the local UI may frame the local Superset origin. */
export function allowFrameAncestor(csp, uiOrigin) {
  const directives = (csp ?? '')
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive && !/^frame-ancestors(\s|$)/i.test(directive));
  return [...directives, `frame-ancestors ${uiOrigin}`].join('; ');
}

/** Maps an upstream redirect back to the local origin; any other origin is refused (null). */
export function localRedirect(location, upstreamOrigin, localOrigin) {
  let url;
  try {
    url = new URL(location, `${upstreamOrigin}/`);
  } catch {
    return null;
  }
  if (url.origin !== upstreamOrigin) return null;
  return `${localOrigin}${url.pathname}${url.search}${url.hash}`;
}
