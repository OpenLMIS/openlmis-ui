import { readdirSync } from 'node:fs';
import { type BrowserContext, test as base, expect, type Page } from '@playwright/test';
import playwrightPackage from '@playwright/test/package.json' with { type: 'json' };

function failClosedRoutes(context: BrowserContext) {
  const route = context.route.bind(context);
  const unroute = context.unroute.bind(context);
  type Handler = Parameters<BrowserContext['route']>[1];
  const handlers = new Map<Handler, Handler>();
  context.route = async (url, handler, options) => {
    const guarded: Handler = async (route, request) => {
      try {
        await handler(route, request);
      } catch (error) {
        await route.abort('blockedbyclient').catch(() => {});
        throw error;
      }
    };
    handlers.set(handler, guarded);
    return route(url, guarded, options);
  };
  context.unroute = (url, handler) =>
    unroute(url, handler ? (handlers.get(handler) ?? handler) : undefined);
}

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
    const dispose = () => context.unroute(args[0], args[1]);
    return { dispose, [Symbol.asyncDispose]: dispose };
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

// Chrome 152 still blocks requests offline but resets navigator.onLine on each new document.
const resetsOnLine = (browserName: string, version: string) =>
  browserName === 'chromium' && Number.parseInt(version, 10) < 156;

async function emulateOnLine(context: BrowserContext, initiallyOffline = false) {
  const setOffline = context.setOffline.bind(context);
  const shim = (offline: boolean) =>
    context.addInitScript((offline) => {
      const native = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')?.get;
      const state = { offline };
      Object.defineProperty(window, '__offlineEmulation', { value: state });
      Object.defineProperty(Navigator.prototype, 'onLine', {
        configurable: true,
        get() {
          return !state.offline && Boolean(native?.call(this));
        },
      });
    }, offline);
  let script = await shim(initiallyOffline);
  context.setOffline = async (next) => {
    await setOffline(next);
    await script.dispose();
    script = await shim(next);
    if (next) return;
    for (const page of context.pages()) {
      await page
        .evaluate(() => {
          const state = Reflect.get(window, '__offlineEmulation') as
            | { offline: boolean }
            | undefined;
          if (!state?.offline) return;
          state.offline = false;
          window.dispatchEvent(new Event('online'));
        })
        .catch((error: unknown) => {
          // A document replaced mid-evaluation boots with the online script.
          if (!String(error).includes('Execution context was destroyed')) throw error;
        });
    }
  };
}

export const test = base.extend<{
  persistentContext: (directory: string, offline?: boolean) => Promise<BrowserContext>;
  firefoxWorkerCache: undefined;
  chromeOnLine: undefined;
  failClosedFixtures: undefined;
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
        'WebKit 27.2 / Playwright 1.64.1 worker-controlled API requests bypass fixtures, including sign-in, access refresh and submission. Offline worker navigation is fixed. See plans/FM-165.md for the isolated reproduction recipe.',
      );
      await use(undefined);
    },
    { auto: true },
  ],
  failClosedFixtures: [
    async ({ context }, use) => {
      failClosedRoutes(context);
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
  chromeOnLine: [
    async ({ context, browser, browserName }, use) => {
      if (resetsOnLine(browserName, browser.version())) await emulateOnLine(context);
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
      failClosedRoutes(context);
      if (browserName === 'firefox') preserveFirefoxWorkerCache(context, offline);
      const version =
        browserName === 'chromium'
          ? await context.pages()[0].evaluate(() => navigator.userAgent.match(/Chrome\/(\d+)/)?.[1])
          : undefined;
      if (resetsOnLine(browserName, version ?? '')) await emulateOnLine(context, offline);
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
          ...readdirSync(new URL('../../public/locales/', import.meta.url))
            .filter((file) => file.endsWith('.json'))
            .map((file) => ({
              cache: 'openlmis-ui-locales',
              url: new URL(`locales/${file}`, baseURL).href,
            })),
        ],
      ),
    )
    .toBe(true);
}
