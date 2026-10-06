import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyBranding,
  DEFAULT_APP_CONFIGURATION,
  DEFAULT_LOGO_URL,
  getAppConfiguration,
  getAppName,
  loadAppConfiguration,
  parseAppConfiguration,
  rememberAppConfiguration,
  setAppConfiguration,
  useAppConfigurationStore,
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
  useAppConfigurationStore.setState({ fromServer: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseAppConfiguration', () => {
  it('keeps every valid field', () => {
    expect(parseAppConfiguration({ ...stored, showAppName: false })).toEqual({
      version: 4,
      appName: 'SIGECA',
      showAppName: false,
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
      showAppName: 'no',
    });

    expect(parsed).toEqual({
      version: 0,
      appName: 'SIGECA',
      showAppName: true,
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

  it('shows the last answer while it waits, so the first paint already has its theme', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    let answer: (response: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );

    const loading = loadAppConfiguration();

    expect(getAppConfiguration().theme.defaultAppearance).toBe('dark');
    answer(new Response(JSON.stringify({ ...stored, appName: 'Fresh' })));
    await loading;
    expect(getAppConfiguration().appName).toBe('Fresh');
  });

  it('keeps the last answer when the gateway has no route to the service for a while', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    vi.stubGlobal('fetch', respond(404));

    await loadAppConfiguration();

    expect(getAppConfiguration().appName).toBe('SIGECA');
    expect(localStorage.getItem(CACHE_KEY)).toBe(JSON.stringify(stored));
  });

  it('uses the defaults when the gateway has no route and nothing was seen before', async () => {
    vi.stubGlobal('fetch', respond(404));

    await loadAppConfiguration();

    expect(getAppConfiguration()).toEqual(DEFAULT_APP_CONFIGURATION);
  });

  it('knows the server keeps settings once it answers', async () => {
    vi.stubGlobal('fetch', respond(200, stored));

    await loadAppConfiguration();

    expect(useAppConfigurationStore.getState().fromServer).toBe(true);
  });

  it('knows the server keeps none while it has never answered, as a backend without them', async () => {
    vi.stubGlobal('fetch', respond(404));

    await loadAppConfiguration();

    expect(useAppConfigurationStore.getState().fromServer).toBe(false);
  });

  it('still counts the settings through a gateway gap once an answer was seen', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    vi.stubGlobal('fetch', respond(404));

    await loadAppConfiguration();

    expect(useAppConfigurationStore.getState().fromServer).toBe(true);
  });

  it('keeps the last answer when a success brings no JSON', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));

    await loadAppConfiguration();

    expect(getAppConfiguration().appName).toBe('SIGECA');
    expect(localStorage.getItem(CACHE_KEY)).toBe(JSON.stringify(stored));
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

  it('falls back to the built-in icon when the configured logo cannot load', () => {
    const images: { src: string; onerror: (() => void) | null }[] = [];
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        onerror: (() => void) | null = null;
        constructor() {
          images.push(this);
        }
      },
    );

    applyBranding(parseAppConfiguration(stored));
    images[0]?.onerror?.();

    expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(DEFAULT_LOGO_URL);
  });

  it('keeps a newer logo when an older one fails to load late', () => {
    const images: { src: string; onerror: (() => void) | null }[] = [];
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        onerror: (() => void) | null = null;
        constructor() {
          images.push(this);
        }
      },
    );
    const newer = { ...stored, logo: { ...stored.logo, url: '/api/appConfiguration/logo?v=new' } };

    applyBranding(parseAppConfiguration(stored));
    applyBranding(parseAppConfiguration(newer));
    images[0]?.onerror?.();

    expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(newer.logo.url);
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

describe('rememberAppConfiguration', () => {
  it('shows a saved configuration at once and keeps it for the next load', () => {
    rememberAppConfiguration(stored);

    expect(getAppConfiguration().appName).toBe('SIGECA');
    expect(localStorage.getItem(CACHE_KEY)).toBe(JSON.stringify(stored));
  });
});
