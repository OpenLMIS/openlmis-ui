import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event?: unknown) => void;
const handlers: Record<string, Handler[]> = {};
const skipWaiting = vi.fn();
const register = vi.fn();

vi.mock('workbox-window', () => ({
  Workbox: vi.fn(function Workbox() {
    return {
      addEventListener: (type: string, handler: Handler) => {
        handlers[type] ??= [];
        handlers[type].push(handler);
      },
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
    getRegistration: async () => ({ waiting: waiting ? { postMessage: skipWaiting } : null }),
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

  it('allows reload only after our worker is active, including activation after registration', async () => {
    vi.useFakeTimers();
    stubServiceWorker({});
    const registration = Object.assign(new EventTarget(), {
      active: { scriptURL: `${location.origin}/legacy-worker.js` },
      update: vi.fn(),
    });
    register.mockResolvedValue(registration);
    const { registerServiceWorker, canReloadIntoWorker } = await load();
    expect(canReloadIntoWorker()).toBe(false);
    registerServiceWorker({ enabled: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(canReloadIntoWorker()).toBe(false);
    for (const handler of handlers.activated) handler({ sw: ours });
    expect(canReloadIntoWorker()).toBe(true);
  });

  it('recognizes our already active registration without a page controller', async () => {
    vi.useFakeTimers();
    stubServiceWorker({});
    register.mockResolvedValue(Object.assign(new EventTarget(), { active: ours, update: vi.fn() }));
    const { registerServiceWorker, canReloadIntoWorker } = await load();
    registerServiceWorker({ enabled: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(canReloadIntoWorker()).toBe(true);
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
    await waitFor(() => expect(register).toHaveBeenCalled());
    await Promise.resolve();
    const { result } = renderHook(() => useUpdateReady());

    act(() => install());

    expect(result.current).toBe(false);
  });

  it('never reloads a tab that did not ask, when another tab takes the update', async () => {
    const worker = stubServiceWorker({});
    const { registerServiceWorker } = await load();
    const reload = vi.fn();
    registerServiceWorker({ enabled: true, reload });

    worker.takeControl(ours);

    expect(reload).not.toHaveBeenCalled();
  });
});

describe('applyUpdate', () => {
  beforeEach(() => skipWaiting.mockReset());

  it('activates the waiting version, then reloads once it controls the page', async () => {
    vi.useFakeTimers();
    const worker = stubServiceWorker({ waiting: true });
    const { applyUpdate, registerServiceWorker } = await load();
    const steps: string[] = [];
    registerServiceWorker({ enabled: true, reload: () => steps.push('reload') });

    await applyUpdate(() => steps.push('before'));
    expect(skipWaiting).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(steps).toEqual([]);

    worker.takeControl(ours);
    expect(steps).toEqual(['before', 'reload']);
    await vi.advanceTimersByTimeAsync(3000);
    expect(steps).toEqual(['before', 'reload']);
  });

  it('reloads anyway when the new version never reports taking control', async () => {
    vi.useFakeTimers();
    stubServiceWorker({ waiting: true });
    const { applyUpdate, registerServiceWorker } = await load();
    const reload = vi.fn();
    registerServiceWorker({ enabled: true, reload });

    await applyUpdate();
    await vi.advanceTimersByTimeAsync(3000);

    expect(reload).toHaveBeenCalledOnce();
  });

  it('just reloads when another tab already activated the new version', async () => {
    stubServiceWorker({ waiting: false });
    const { applyUpdate, registerServiceWorker } = await load();
    const reload = vi.fn();
    registerServiceWorker({ enabled: true, reload });

    await applyUpdate();

    expect(skipWaiting).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
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
      `${base}locales/es.json`,
      `${base}locales/fr.json`,
    ]);
  });

  it('fetches at once when our worker already controls the page', async () => {
    stubServiceWorker({ controller: ours });
    const { registerServiceWorker } = await load();

    registerServiceWorker({ enabled: true });

    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it('leaves the legacy UI worker alone, which may control the page before ours', async () => {
    vi.stubEnv('BASE_URL', '/v2/');
    stubServiceWorker({ controller: { scriptURL: `${location.origin}/sw.js` } });
    const { registerServiceWorker } = await load();

    registerServiceWorker({ enabled: true });

    expect(fetch).not.toHaveBeenCalled();
  });
});
