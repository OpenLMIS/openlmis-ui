import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event?: unknown) => void;
const handlers: Record<string, Handler[]> = {};
const messageSkipWaiting = vi.fn();
const register = vi.fn();

vi.mock('workbox-window', () => ({
  Workbox: vi.fn(function Workbox() {
    return {
      addEventListener: (type: string, handler: Handler) => {
        handlers[type] ??= [];
        handlers[type].push(handler);
      },
      messageSkipWaiting,
      register,
    };
  }),
}));

const base = import.meta.env.BASE_URL;
const ours = { scriptURL: `${location.origin}${base}sw.js` };
const fire = (type: string) => {
  for (const handler of handlers[type] ?? []) handler({});
};

function stubServiceWorker({ controller = null as { scriptURL: string } | null, waiting = false }) {
  const target = new EventTarget();
  const container = Object.assign(target, {
    controller,
    getRegistration: async () => ({ waiting: waiting ? {} : null }),
  });
  vi.stubGlobal('navigator', { ...navigator, serviceWorker: container });
  return {
    takeControl: (next: { scriptURL: string }) => {
      container.controller = next;
      target.dispatchEvent(new Event('controllerchange'));
    },
  };
}

async function load() {
  vi.resetModules();
  return import('@/lib/service-worker');
}

beforeEach(() => {
  for (const type of Object.keys(handlers)) delete handlers[type];
  register.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
});

afterEach(() => vi.unstubAllGlobals());

describe('registerServiceWorker', () => {
  it('does nothing outside a production build, where there is no worker to register', async () => {
    stubServiceWorker({});
    const { registerServiceWorker } = await load();

    registerServiceWorker({ enabled: false });

    expect(register).not.toHaveBeenCalled();
  });

  it('registers once, however often it is called', async () => {
    stubServiceWorker({});
    const { registerServiceWorker } = await load();

    registerServiceWorker({ enabled: true });
    registerServiceWorker({ enabled: true });

    expect(register).toHaveBeenCalledOnce();
  });

  it('tells every tab a new version is ready, including one installed from another tab', async () => {
    stubServiceWorker({});
    const { registerServiceWorker, useUpdateReady } = await load();
    registerServiceWorker({ enabled: true });
    const { result } = renderHook(() => useUpdateReady());
    expect(result.current).toBe(false);

    act(() => fire('waiting'));

    expect(result.current).toBe(true);
  });

  it('never reloads a tab that did not ask, when another tab takes the update', async () => {
    stubServiceWorker({});
    const { registerServiceWorker } = await load();
    const reload = vi.fn();
    registerServiceWorker({ enabled: true, reload });

    fire('controlling');

    expect(reload).not.toHaveBeenCalled();
  });
});

describe('applyUpdate', () => {
  it('activates the waiting version, then reloads once it controls the page', async () => {
    stubServiceWorker({ waiting: true });
    const { applyUpdate, registerServiceWorker } = await load();
    const reload = vi.fn();
    registerServiceWorker({ enabled: true, reload });

    await applyUpdate();
    expect(messageSkipWaiting).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();

    fire('controlling');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('just reloads when another tab already activated the new version', async () => {
    stubServiceWorker({ waiting: false });
    const { applyUpdate, registerServiceWorker } = await load();
    const reload = vi.fn();
    registerServiceWorker({ enabled: true, reload });

    await applyUpdate();

    expect(messageSkipWaiting).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe('dismissUpdate', () => {
  it('hides the notice until the next start', async () => {
    stubServiceWorker({});
    const { dismissUpdate, registerServiceWorker, useUpdateReady } = await load();
    registerServiceWorker({ enabled: true });
    const { result } = renderHook(() => useUpdateReady());
    act(() => fire('waiting'));

    act(() => dismissUpdate());

    expect(result.current).toBe(false);
  });
});

describe('warming the offline files', () => {
  it('fetches the config and every language once our worker controls the page', async () => {
    const worker = stubServiceWorker({});
    const { registerServiceWorker } = await load();
    registerServiceWorker({ enabled: true });
    expect(fetch).not.toHaveBeenCalled();

    worker.takeControl(ours);

    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      `${base}config.json`,
      `${base}locales/en.json`,
      `${base}locales/pt.json`,
      `${base}locales/ar.json`,
    ]);
  });

  it('fetches at once when our worker already controls the page', async () => {
    stubServiceWorker({ controller: ours });
    const { registerServiceWorker } = await load();

    registerServiceWorker({ enabled: true });

    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('leaves the legacy UI worker alone, which may control the page before ours', async () => {
    vi.stubEnv('BASE_URL', '/v2/');
    stubServiceWorker({ controller: { scriptURL: `${location.origin}/sw.js` } });
    const { registerServiceWorker } = await load();

    registerServiceWorker({ enabled: true });

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
