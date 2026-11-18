// @vitest-environment node
import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { apiDecision } from './guards.mjs';
import { createSupersetProxy } from './superset-proxy.mjs';

const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done))));
});

const listen = (server) =>
  new Promise((resolve) => {
    servers.push(server);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });

/** A fake Superset that records what reached it and answers as the test asks. */
async function fakeUpstream(answer = (_request, response) => response.end('ok')) {
  const seen = [];
  const port = await listen(
    http.createServer((request, response) => {
      seen.push({ method: request.method, url: request.url, headers: request.headers });
      answer(request, response);
    }),
  );
  return { seen, origin: `http://127.0.0.1:${port}` };
}

async function proxyTo(upstream) {
  const proxy = createSupersetProxy({
    upstream,
    localOrigin: 'http://localhost:5174',
    uiOrigin: 'http://localhost:5173',
    upstreamUiOrigin: 'https://lmis.example.org',
  });
  const port = await listen(proxy);
  return (path, { method = 'GET', headers = {} } = {}) =>
    new Promise((resolve, reject) => {
      const request = http.request(
        { host: '127.0.0.1', port, path, method, headers: { host: 'localhost:5174', ...headers } },
        (response) => {
          response.resume();
          response.on('end', () =>
            resolve({
              status: response.statusCode,
              headers: { get: (name) => response.headers[name] ?? null },
            }),
          );
        },
      );
      request.on('error', reject);
      request.end();
    });
}

describe('Superset proxy', () => {
  it('forwards a guest read as UAT would see it, without cookies, bearer or caller routing', async () => {
    const upstream = await fakeUpstream();
    const request = await proxyTo(upstream.origin);

    await request('/embedded/abc?uiConfig=1', {
      headers: {
        cookie: 'session=admin',
        authorization: 'Bearer synthetic',
        'x-guesttoken': 'synthetic-guest',
        'x-forwarded-host': 'evil.example.org',
        forwarded: 'host=evil.example.org',
        referer: 'http://localhost:5173/v2/reports/dashboards/r1?x=1',
        origin: 'http://elsewhere.example.org',
      },
    });

    const [{ url, headers }] = upstream.seen;
    expect(url).toBe('/embedded/abc?uiConfig=1');
    expect(headers.host).toBe(new URL(upstream.origin).host);
    expect(headers['x-guesttoken']).toBe('synthetic-guest');
    expect(headers.referer).toBe('https://lmis.example.org/');
    for (const name of ['cookie', 'authorization', 'x-forwarded-host', 'forwarded', 'origin'])
      expect(headers).not.toHaveProperty(name);
  });

  it('lets only the local UI frame it and never hands out upstream cookies', async () => {
    const upstream = await fakeUpstream((_request, response) => {
      response.setHeader('set-cookie', 'session=x; Path=/');
      response.setHeader('x-frame-options', 'SAMEORIGIN');
      response.setHeader('content-security-policy', "default-src 'self'; frame-ancestors 'self'");
      response.end('ok');
    });
    const response = await (await proxyTo(upstream.origin))('/embedded/abc');

    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-frame-options')).toBeNull();
    expect(response.headers.get('content-security-policy')).toBe(
      "default-src 'self'; frame-ancestors http://localhost:5173",
    );
  });

  it('keeps redirects on the local origin and refuses one that leaves it', async () => {
    let target = '';
    const upstream = await fakeUpstream((_request, response) => {
      response.writeHead(302, { location: target });
      response.end();
    });
    const request = await proxyTo(upstream.origin);

    target = `${upstream.origin}/login/?next=/x`;
    expect((await request('/a')).headers.get('location')).toBe(
      'http://localhost:5174/login/?next=/x',
    );
    target = 'https://elsewhere.example.org/steal';
    expect((await request('/b')).status).toBe(502);
  });

  it.each([
    ['POST', '/api/v1/dashboard/1'],
    ['PUT', '/api/v1/chart/data'],
    ['POST', '/api/v1/chart/data/../dashboard/1'],
    ['POST', '/api/v1/chart/%2e%2e/dashboard'],
    ['POST', '/api/v1/chart/data/1'],
    ['DELETE', '/api/v1/dashboard/1/filter_state/x'],
  ])('refuses %s %s without reaching UAT', async (method, path) => {
    const upstream = await fakeUpstream();
    expect((await (await proxyTo(upstream.origin))(path, { method })).status).toBe(405);
    expect(upstream.seen).toEqual([]);
  });

  it('allows chart queries, answers telemetry itself and refuses an unexpected host', async () => {
    const upstream = await fakeUpstream();
    const request = await proxyTo(upstream.origin);

    expect((await request('/api/v1/chart/data?form_data=1', { method: 'POST' })).status).toBe(200);
    expect((await request('/superset/log/?explode=events', { method: 'POST' })).status).toBe(200);
    expect((await request('/x', { headers: { host: 'evil.example.org' } })).status).toBe(421);
    expect(upstream.seen.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'POST /api/v1/chart/data?form_data=1',
    ]);
  });

  it('refuses to share an origin with the UI', () => {
    expect(() =>
      createSupersetProxy({
        upstream: 'http://127.0.0.1:1',
        localOrigin: 'http://localhost:5173',
        uiOrigin: 'http://localhost:5173',
        upstreamUiOrigin: 'https://lmis.example.org',
      }),
    ).toThrow();
  });
});

describe('OpenLMIS API guard', () => {
  it.each([
    ['GET', '/api/facilities?page=0', 'forward'],
    ['POST', '/api/oauth/token?grant_type=password', 'forward'],
    ['POST', '/api/oauth/token?grant_type=password&scope=x', 'deny'],
    ['POST', '/api/oauth/token?grant_type=client_credentials', 'deny'],
    ['POST', '/api/users/auth/logout', 'local-logout'],
    ['GET', '/api/orders/o1/retry', 'deny'],
    ['GET', '/api/orders/o1/../o1/retry', 'deny'],
    ['PUT', '/api/users/u1', 'deny'],
    ['POST', '/api/stockEvents', 'deny'],
    ['POST', '/api/reports/templates/common/r1/pdf', 'deny'],
  ])('%s %s is %s', (method, path, decision) => {
    expect(apiDecision(method, path)).toBe(decision);
  });

  it('refuses a read that asks to be treated as another method', () => {
    expect(apiDecision('GET', '/api/users', { 'x-http-method-override': 'DELETE' })).toBe('deny');
  });
});
