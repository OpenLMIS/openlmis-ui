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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

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

  function stubRegistration() {
    const registration = Object.assign(new EventTarget(), {
      installing: null as (EventTarget & { state: string }) | null,
    });
    register.mockResolvedValue(registration);
    return () => {
      const worker = Object.assign(new EventTarget(), { state: 'installing' });
      registration.installing = worker;
      registration.dispatchEvent(new Event('updatefound'));
      worker.state = 'installed';
      worker.dispatchEvent(new Event('statechange'));
    };
  }

  it('tells the tab about every later version, not only the first one after it opened', async () => {
    stubServiceWorker({ controller: ours });
    const install = stubRegistration();
    const { dismissUpdate, registerServiceWorker, useUpdateReady } = await load();
    registerServiceWorker({ enabled: true });
    await vi.waitFor(() => expect(register).toHaveBeenCalled());
    await Promise.resolve();
    const { result } = renderHook(() => useUpdateReady());

    act(() => install());
    expect(result.current).toBe(true);
    act(() => dismissUpdate());
    act(() => install());

    expect(result.current).toBe(true);
  });

  it('checks for a new version every hour', async () => {
    vi.useFakeTimers();
    stubServiceWorker({ controller: ours });
    const update = vi.fn().mockResolvedValue(undefined);
    register.mockResolvedValue(Object.assign(new EventTarget(), { update }));
    const { registerServiceWorker } = await load();
    registerServiceWorker({ enabled: true });
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 - 1);
    expect(update).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(update).toHaveBeenCalledOnce();
  });

  it('offers nothing when our first version installs under the legacy UI worker', async () => {
    stubServiceWorker({ controller: { scriptURL: `${location.origin}/service-worker.js` } });
    const install = stubRegistration();
    const { registerServiceWorker, useUpdateReady } = await load();
    registerServiceWorker({ enabled: true });
    await vi.waitFor(() => expect(register).toHaveBeenCalled());
    await Promise.resolve();
    const { result } = renderHook(() => useUpdateReady());

    act(() => install());

    expect(result.current).toBe(false);
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

  it('runs the step before reloading only when the reload happens', async () => {
    stubServiceWorker({ waiting: true });
    const { applyUpdate, registerServiceWorker } = await load();
    const steps: string[] = [];
    registerServiceWorker({ enabled: true, reload: () => steps.push('reload') });

    await applyUpdate(() => steps.push('before'));
    expect(steps).toEqual([]);
    fire('controlling');

    expect(steps).toEqual(['before', 'reload']);
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
  });
});
