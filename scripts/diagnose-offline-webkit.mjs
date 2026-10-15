import { createServer } from 'node:http';
import { chromium, expect, webkit } from '@playwright/test';
import playwrightPackage from '@playwright/test/package.json' with { type: 'json' };

for (const engine of [webkit, chromium]) {
  const server = createServer((request, response) => {
    if (request.url === '/sw.js') {
      response.setHeader('Content-Type', 'application/javascript');
      response.end(
        `self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate' || new URL(event.request.url).pathname === '/worker-fetch') {
    event.respondWith(new Response('<h1>Literal worker</h1>', {
      headers: { 'Content-Type': 'text/html' },
    }));
  }
});`,
      );
    } else if (request.url === '/slow-server') {
      setTimeout(() => response.end('delayed server'), 250);
    } else response.end(request.url === '/api' ? 'server' : '<h1>Online</h1>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await engine.launch({ headless: true });
    console.log(engine.name(), 'versions', {
      browser: browser.version(),
      playwright: playwrightPackage.version,
    });
    const context = await browser.newContext();
    await context.route('**/api', (route) => route.fulfill({ body: 'fixture' }));
    const page = await context.newPage();
    await page.goto(origin);
    console.log(
      engine.name(),
      'before-worker',
      await page.evaluate(() => fetch('/api').then((r) => r.text())),
    );
    await context.route('**/slow', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ body: 'delayed fixture' }).catch(() => {});
    });
    console.log(
      engine.name(),
      'routed-xhr-timeout',
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const request = new XMLHttpRequest();
            request.open('GET', '/slow');
            request.timeout = 40;
            request.ontimeout = () => resolve('timeout');
            request.onload = () => resolve('load');
            request.onerror = () => resolve('error');
            request.send();
          }),
      ),
    );
    await context.route('**/slow-continued', (route) =>
      route.continue({ url: `${origin}/slow-server` }),
    );
    for (const path of ['/slow-continued', '/slow-server']) {
      console.log(
        engine.name(),
        path,
        await page.evaluate(
          (path) =>
            new Promise((resolve) => {
              const request = new XMLHttpRequest();
              request.open('GET', path);
              request.timeout = 40;
              request.ontimeout = () => resolve('timeout');
              request.onload = () => resolve('load');
              request.onerror = () => resolve('error');
              request.send();
            }),
          path,
        ),
      );
    }
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    console.log(
      engine.name(),
      'after-worker',
      await page.evaluate(() => fetch('/api').then((r) => r.text())),
    );
    await context.unrouteAll();
    await page.goto(`${origin}/controlled-online`);
    console.log(engine.name(), 'online-literal', await page.locator('h1').innerText());
    await context.setOffline(true);
    console.log(
      engine.name(),
      'offline-worker-fetch',
      await page.evaluate(() =>
        fetch('/worker-fetch')
          .then((response) => response.text())
          .catch(String),
      ),
    );
    try {
      await page.goto(`${origin}/uncached`);
      console.log(engine.name(), 'offline-literal', await page.locator('h1').innerText());
    } catch (error) {
      console.log(engine.name(), 'offline-literal', String(error));
    }
    await context.close();
    if (process.env.OFFLINE_PREVIEW_URL) {
      const app = await browser.newContext();
      const page = await app.newPage();
      await page.goto(new URL('login', process.env.OFFLINE_PREVIEW_URL).href);
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      const baseURL = process.env.OFFLINE_PREVIEW_URL;
      await expect
        .poll(() =>
          page.evaluate(async (baseURL) => {
            const files = [
              ['openlmis-ui-config', 'config.json'],
              ...['en', 'ar', 'es', 'fr', 'pt'].map((language) => [
                'openlmis-ui-locales',
                `locales/${language}.json`,
              ]),
            ];
            const ready = await Promise.all(
              files.map(async ([cache, path]) => {
                const response = await (await caches.open(cache)).match(
                  new URL(path, baseURL).href,
                );
                return response ? Boolean(await response.json()) : false;
              }),
            );
            return ready.every(Boolean);
          }, baseURL),
        )
        .toBe(true);
      await app.setOffline(true);
      console.log(engine.name(), 'app-native-online', await page.evaluate(() => navigator.onLine));
      try {
        await page.reload();
        console.log(
          engine.name(),
          'app-offline-reload',
          await page.getByRole('button', { name: 'Sign In', exact: true }).innerText(),
        );
      } catch (error) {
        console.log(engine.name(), 'app-offline-reload', String(error));
      }
      await app.close();
    }
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
