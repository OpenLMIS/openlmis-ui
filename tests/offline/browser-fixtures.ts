import { type BrowserContext, test as base, expect, type Page } from '@playwright/test';
import playwrightPackage from '@playwright/test/package.json' with { type: 'json' };

// Firefox interception disables its worker cache; remove routes only while truly offline.
function preserveFirefoxWorkerCache(context: BrowserContext, initiallyOffline = false) {
  const route = context.route.bind(context);
  const unroute = context.unroute.bind(context);
  const unrouteAll = context.unrouteAll.bind(context);
  const setOffline = context.setOffline.bind(context);
  let routes: Parameters<BrowserContext['route']>[] = [];
  let offline = initiallyOffline;
  context.route = async (...args) => {
    routes.push(args);
    if (!offline) await route(...args);
  };
  context.unroute = async (url, handler) => {
    routes = routes.filter(
      ([savedUrl, savedHandler]) => savedUrl !== url || (handler && savedHandler !== handler),
    );
    if (!offline) await unroute(url, handler);
  };
  context.setOffline = async (next) => {
    if (next === offline) return;
    if (next) {
      await setOffline(true);
      await unrouteAll({ behavior: 'ignoreErrors' });
    } else {
      for (const args of routes) await route(...args);
      await setOffline(false);
    }
    offline = next;
    for (const page of context.pages()) {
      await page.waitForFunction((expected) => navigator.onLine === expected, !next);
      await page.evaluate(
        (event) => window.dispatchEvent(new Event(event)),
        next ? 'offline' : 'online',
      );
    }
  };
}

export const test = base.extend<{
  persistentContext: (directory: string, offline?: boolean) => Promise<BrowserContext>;
  firefoxWorkerCache: undefined;
  webkitFixtureRouting: undefined;
}>({
  serviceWorkers: async ({ browserName }, use, testInfo) => {
    await use(
      browserName === 'webkit' && !testInfo.tags.includes('@offline-shell') ? 'block' : 'allow',
    );
  },
  webkitFixtureRouting: [
    async ({ browser, browserName }, use, testInfo) => {
      test.skip(
        browserName === 'webkit' &&
          browser.version() === '27.2' &&
          playwrightPackage.version === '1.64.1' &&
          testInfo.tags.includes('@webkit-fixture-routing'),
        'WebKit 27.2 / Playwright 1.64.1 worker-controlled API requests bypass fixtures, including sign-in, access refresh and submission. Offline worker navigation is fixed. Reproduce with scripts/diagnose-offline-webkit.mjs.',
      );
      await use(undefined);
    },
    { auto: true },
  ],
  firefoxWorkerCache: [
    async ({ context, browserName }, use) => {
      if (browserName === 'firefox') preserveFirefoxWorkerCache(context);
      await use(undefined);
    },
    { auto: true },
  ],
  persistentContext: async ({ playwright, browserName, channel, baseURL, serviceWorkers }, use) => {
    await use(async (directory, offline = false) => {
      const context = await playwright[browserName].launchPersistentContext(directory, {
        baseURL,
        headless: true,
        serviceWorkers,
        channel,
        offline,
      });
      if (browserName === 'firefox') preserveFirefoxWorkerCache(context, offline);
      return context;
    });
  },
});

export async function waitForOfflineShell(page: Page) {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error('Offline tests require a base URL');
  await page.waitForFunction(
    (worker) => navigator.serviceWorker.controller?.scriptURL === worker,
    new URL('sw.js', baseURL).href,
  );
  await expect
    .poll(() =>
      page.evaluate(
        async (files) => {
          const ready = await Promise.all(
            files.map(async ({ cache, url }) => {
              const response = await (await caches.open(cache)).match(url);
              return response ? Boolean(await response.json()) : false;
            }),
          );
          return ready.every(Boolean);
        },
        [
          { cache: 'openlmis-ui-config', url: new URL('config.json', baseURL).href },
          ...['en', 'ar', 'es', 'fr', 'pt'].map((language) => ({
            cache: 'openlmis-ui-locales',
            url: new URL(`locales/${language}.json`, baseURL).href,
          })),
        ],
      ),
    )
    .toBe(true);
}
