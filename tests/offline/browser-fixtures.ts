import { type BrowserContext, test as base } from '@playwright/test';

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
}>({
  firefoxWorkerCache: [
    async ({ context, browserName }, use) => {
      if (browserName === 'firefox') preserveFirefoxWorkerCache(context);
      await use(undefined);
    },
    { auto: true },
  ],
  persistentContext: async ({ playwright, browserName, channel, baseURL }, use) => {
    await use(async (directory, offline = false) => {
      const context = await playwright[browserName].launchPersistentContext(directory, {
        baseURL,
        headless: true,
        serviceWorkers: 'allow',
        channel,
        offline,
      });
      if (browserName === 'firefox') preserveFirefoxWorkerCache(context, offline);
      return context;
    });
  },
});
