import { afterEach, describe, expect, it, vi } from 'vitest';
import { warmOfflineCache } from '@/lib/warm-offline';

type Controller = { scriptURL: string } | null;

function stubServiceWorker(controller: Controller) {
  const listeners: Array<() => void> = [];
  const container = {
    controller,
    addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
  };
  vi.stubGlobal('navigator', { ...navigator, serviceWorker: container });
  return {
    takeControl: (next: Controller) => {
      container.controller = next;
      for (const listener of listeners) listener();
    },
  };
}

const ours = { scriptURL: `${location.origin}${import.meta.env.BASE_URL}sw.js` };

afterEach(() => vi.unstubAllGlobals());

describe('warmOfflineCache', () => {
  it('fetches the config and every language once our worker controls the page', () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const worker = stubServiceWorker(null);

    warmOfflineCache();
    expect(fetch).not.toHaveBeenCalled();

    worker.takeControl(ours);

    const urls = fetch.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([
      `${import.meta.env.BASE_URL}config.json`,
      `${import.meta.env.BASE_URL}locales/en.json`,
      `${import.meta.env.BASE_URL}locales/pt.json`,
      `${import.meta.env.BASE_URL}locales/ar.json`,
    ]);
  });

  it('fetches at once when our worker already controls the page', () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    stubServiceWorker(ours);

    warmOfflineCache();

    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('leaves the legacy UI worker alone, which may control the page before ours', async () => {
    vi.stubEnv('BASE_URL', '/v2/');
    vi.resetModules();
    const { warmOfflineCache: warmUnderV2 } = await import('@/lib/warm-offline');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    stubServiceWorker({ scriptURL: `${location.origin}/sw.js` });

    warmUnderV2();

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('swallows a failed fetch, since this only prepares for later', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    stubServiceWorker(ours);

    expect(() => warmOfflineCache()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
