import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyBranding,
  DEFAULT_APP_CONFIGURATION,
  DEFAULT_LOGO_URL,
  getAppConfiguration,
  getAppName,
  loadAppConfiguration,
  parseAppConfiguration,
  setAppConfiguration,
} from '@/lib/app-configuration';

const CACHE_KEY = 'openlmis-ui.app-configuration';

const stored = {
  version: 4,
  appName: 'SIGECA',
  logo: { url: '/api/appConfiguration/logo?v=abc', contentType: 'image/webp', size: 10 },
  theme: { preset: 'teal', defaultAppearance: 'dark' },
  featureFlags: { BATCH_APPROVE_SCREEN: true },
  modifiedDate: '2026-09-29T10:00:00Z',
};

function respond(status: number, body?: unknown) {
  return vi
    .fn()
    .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
}

beforeEach(() => {
  localStorage.clear();
  setAppConfiguration(DEFAULT_APP_CONFIGURATION);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseAppConfiguration', () => {
  it('keeps every valid field', () => {
    expect(parseAppConfiguration(stored)).toEqual({
      version: 4,
      appName: 'SIGECA',
      logo: { url: '/api/appConfiguration/logo?v=abc', contentType: 'image/webp' },
      theme: { preset: 'teal', defaultAppearance: 'dark' },
      featureFlags: { BATCH_APPROVE_SCREEN: true },
    });
  });

  it('falls back field by field, so one bad setting never discards the others', () => {
    const parsed = parseAppConfiguration({
      appName: 'SIGECA',
      logo: { url: 'https://elsewhere.example/logo.png', contentType: 'image/png' },
      theme: { preset: 'teal', defaultAppearance: 'sepia' },
      featureFlags: 'on',
    });

    expect(parsed).toEqual({
      version: 0,
      appName: 'SIGECA',
      logo: null,
      theme: { preset: 'teal', defaultAppearance: null },
      featureFlags: {},
    });
  });

  it('treats a blank name as the default', () => {
    expect(parseAppConfiguration({ appName: '   ' }).appName).toBeNull();
  });

  it('gives the defaults for anything that is not an object', () => {
    expect(parseAppConfiguration('nope')).toEqual(DEFAULT_APP_CONFIGURATION);
    expect(parseAppConfiguration(null)).toEqual(DEFAULT_APP_CONFIGURATION);
  });
});

describe('loadAppConfiguration', () => {
  it('reads the public endpoint without a token and remembers the answer', async () => {
    const fetch = respond(200, stored);
    vi.stubGlobal('fetch', fetch);

    await loadAppConfiguration();

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/appConfiguration');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(getAppConfiguration().appName).toBe('SIGECA');
    expect(localStorage.getItem(CACHE_KEY)).toBe(JSON.stringify(stored));
  });

  it('uses the defaults and forgets the last answer when the server has no configuration', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    vi.stubGlobal('fetch', respond(404));

    await loadAppConfiguration();

    expect(getAppConfiguration()).toEqual(DEFAULT_APP_CONFIGURATION);
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('uses the last answer when the server cannot be reached', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await loadAppConfiguration();

    expect(getAppConfiguration().appName).toBe('SIGECA');
  });

  it('uses the last answer when the server fails', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    vi.stubGlobal('fetch', respond(502));

    await loadAppConfiguration();

    expect(getAppConfiguration().appName).toBe('SIGECA');
  });

  it('uses the defaults when the server cannot be reached and nothing was seen before', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await loadAppConfiguration();

    expect(getAppConfiguration()).toEqual(DEFAULT_APP_CONFIGURATION);
  });

  it('ignores a remembered answer that is not JSON', async () => {
    localStorage.setItem(CACHE_KEY, '{broken');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await loadAppConfiguration();

    expect(getAppConfiguration()).toEqual(DEFAULT_APP_CONFIGURATION);
  });

  it('stops waiting after three seconds and never applies the late answer', async () => {
    vi.useFakeTimers();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...stored, appName: 'Cached' }));
    let answer: (response: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            answer = resolve;
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('', 'AbortError')),
            );
          }),
      ),
    );

    const loading = loadAppConfiguration();
    await vi.advanceTimersByTimeAsync(3000);
    await loading;
    answer(new Response(JSON.stringify({ ...stored, appName: 'Late' })));
    await vi.runAllTimersAsync();

    expect(getAppConfiguration().appName).toBe('Cached');
  });
});

describe('applyBranding', () => {
  beforeEach(() => {
    document.head.innerHTML = '<link rel="icon" type="image/png" href="/olmis.png" />';
  });

  it('names the tab and sets the favicon from the configuration', () => {
    applyBranding(parseAppConfiguration(stored));

    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(document.title).toBe('SIGECA');
    expect(icon?.getAttribute('href')).toBe('/api/appConfiguration/logo?v=abc');
    expect(icon?.type).toBe('image/webp');
  });

  it('falls back to the built-in name and logo under the base path', () => {
    applyBranding(DEFAULT_APP_CONFIGURATION);

    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(document.title).toBe('OpenLMIS');
    expect(icon?.getAttribute('href')).toBe(DEFAULT_LOGO_URL);
    expect(DEFAULT_LOGO_URL).toBe(`${import.meta.env.BASE_URL}olmis.png`);
  });
});

describe('getAppName', () => {
  it('is the configured name, or OpenLMIS', () => {
    expect(getAppName(DEFAULT_APP_CONFIGURATION)).toBe('OpenLMIS');
    expect(getAppName(parseAppConfiguration(stored))).toBe('SIGECA');
  });
});
