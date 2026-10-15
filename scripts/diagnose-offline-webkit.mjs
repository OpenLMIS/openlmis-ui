import { createServer } from 'node:http';
import { chromium, webkit } from '@playwright/test';

for (const engine of [webkit, chromium]) {
  const server = createServer((request, response) => {
    if (request.url === '/sw.js') {
      response.setHeader('Content-Type', 'application/javascript');
      response.end(
        `self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(new Response('<h1>Literal worker</h1>', {
      headers: { 'Content-Type': 'text/html' },
    }));
  }
});`,
      );
    } else response.end(request.url === '/api' ? 'server' : '<h1>Online</h1>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await engine.launch({ headless: true });
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
    await context.setOffline(true);
    try {
      await page.goto(`${origin}/uncached`);
      console.log(engine.name(), 'offline-literal', await page.locator('h1').innerText());
    } catch (error) {
      console.log(engine.name(), 'offline-literal', String(error));
    }
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
