import { onlineManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dismissBackOnline,
  isOnline,
  reportConnectionFailure,
  reportConnectionSuccess,
  seedOnline,
  useBackOnline,
  useOnline,
  useOnReconnect,
} from '@/lib/online';

afterEach(() => {
  reportConnectionSuccess();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  act(() => {
    onlineManager.setOnline(true);
    dismissBackOnline();
  });
});

describe('online', () => {
  it('starts from what the browser knows, since an app opened offline is never told', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    seedOnline();

    expect(isOnline()).toBe(false);
  });

  it('starts online when the browser is, whatever the app last heard', () => {
    onlineManager.setOnline(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    seedOnline();

    expect(isOnline()).toBe(true);
  });

  it('hears the connection come back while the app is still starting', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    seedOnline();
    expect(isOnline()).toBe(false);

    window.dispatchEvent(new Event('online'));

    expect(isOnline()).toBe(true);
  });

  it('follows the connection as it comes and goes', () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => onlineManager.setOnline(false));
    expect(result.current).toBe(false);

    act(() => onlineManager.setOnline(true));
    expect(result.current).toBe(true);
  });
});

describe('useBackOnline', () => {
  it('is true for a few seconds once the connection is back', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBackOnline());
    act(() => onlineManager.setOnline(false));
    expect(result.current).toBe(false);

    act(() => onlineManager.setOnline(true));
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(4000));
    expect(result.current).toBe(false);
  });

  it('can be dismissed sooner', () => {
    const { result } = renderHook(() => useBackOnline());
    act(() => onlineManager.setOnline(false));
    act(() => onlineManager.setOnline(true));

    act(() => dismissBackOnline());

    expect(result.current).toBe(false);
  });
});

describe('useOnReconnect', () => {
  it('runs the latest callback each time the connection comes back, and only then', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = renderHook(({ run }) => useOnReconnect(run), {
      initialProps: { run: first },
    });
    rerender({ run: latest });

    act(() => onlineManager.setOnline(false));
    expect(latest).not.toHaveBeenCalled();
    act(() => onlineManager.setOnline(true));

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });
});

describe('server reachability', () => {
  it('stays offline through failed probes and browser online hints, then reconnects once', async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('unreachable'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ timeZoneId: 'UTC' }) });
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const reconnect = vi.fn();
    renderHook(() => useOnReconnect(reconnect));
    const { reportConnectionFailure } = await import('@/lib/online');
    const { AxiosError } = await import('axios');
    reportConnectionFailure(new AxiosError('network', AxiosError.ERR_NETWORK));
    expect(isOnline()).toBe(false);
    seedOnline();
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(isOnline()).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/localeSettings',
      expect.objectContaining({ cache: 'no-store' }),
    );
    await vi.advanceTimersByTimeAsync(1999);
    expect(isOnline()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(isOnline()).toBe(true);
    expect(reconnect).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(120000);
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
  it('does not treat cancellations, local absence or HTTP refusals as lost connectivity', async () => {
    const { reportConnectionFailure } = await import('@/lib/online');
    const { AxiosError } = await import('axios');
    reportConnectionFailure(new AxiosError('cancelled', AxiosError.ERR_CANCELED));
    reportConnectionFailure(new Error('local absence'));
    expect(isOnline()).toBe(true);
  });
});

it('bounds unreachable-server probe backoff at thirty seconds', async () => {
  vi.useFakeTimers();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const fetch = vi.fn().mockRejectedValue(new TypeError('unreachable'));
  vi.stubGlobal('fetch', fetch);
  const { reportConnectionFailure } = await import('@/lib/online');
  const { AxiosError } = await import('axios');
  reportConnectionFailure(new AxiosError('network', AxiosError.ERR_NETWORK));
  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
    const before = fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(fetch).toHaveBeenCalledTimes(before);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(before + 1);
    expect(isOnline()).toBe(false);
  }
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

it('keeps escalating through successful probes when the API still has no response', async () => {
  vi.useFakeTimers();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ timeZoneId: 'UTC' }) });
  vi.stubGlobal('fetch', fetch);
  const fail = () => reportConnectionFailure(new AxiosError('network', AxiosError.ERR_NETWORK));
  fail();
  for (const delay of [1000, 2000, 4000, 8000]) {
    const before = fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(fetch).toHaveBeenCalledTimes(before);
    await vi.advanceTimersByTimeAsync(1);
    expect(isOnline()).toBe(true);
    fail();
  }
  reportConnectionSuccess();
  onlineManager.setOnline(true);
  fail();
  const before = fetch.mock.calls.length;
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).toHaveBeenCalledTimes(before + 1);
});

it.each(['seed', 'browser'])(
  'an explicit %s hint replaces a backed-off timer without overlapping probes',
  async (hint) => {
    vi.useFakeTimers();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    let answer!: (response: { ok: boolean; json: () => Promise<unknown> }) => void;
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      );
    vi.stubGlobal('fetch', fetch);
    reportConnectionFailure(new AxiosError('network', AxiosError.ERR_NETWORK));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(1);
    const retry = () =>
      hint === 'seed' ? seedOnline() : window.dispatchEvent(new Event('online'));
    retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    answer({ ok: true, json: async () => ({ timeZoneId: 'UTC' }) });
    await vi.advanceTimersByTimeAsync(0);
    expect(isOnline()).toBe(true);
  },
);

it('rejects captive portal HTML and unrelated JSON before reconnecting', async () => {
  vi.useFakeTimers();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new SyntaxError('HTML');
      },
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ signedIn: false }) })
    .mockResolvedValue({ ok: true, json: async () => ({ timeZoneId: 'UTC' }) });
  vi.stubGlobal('fetch', fetch);
  reportConnectionFailure(new AxiosError('network', AxiosError.ERR_NETWORK));
  await vi.advanceTimersByTimeAsync(1000);
  expect(isOnline()).toBe(false);
  await vi.advanceTimersByTimeAsync(2000);
  expect(isOnline()).toBe(false);
  await vi.advanceTimersByTimeAsync(4000);
  expect(isOnline()).toBe(true);
});

it('restores connectivity on API success and cancels an in-flight probe', async () => {
  vi.useFakeTimers();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const fetch = vi.fn((_url: string, _options: RequestInit) => new Promise<Response>(() => {}));
  vi.stubGlobal('fetch', fetch);
  const reconnect = vi.fn();
  renderHook(() => useOnReconnect(reconnect));
  reportConnectionFailure(new AxiosError('network', AxiosError.ERR_NETWORK));
  await vi.advanceTimersByTimeAsync(1000);
  const signal = fetch.mock.calls[0][1].signal;
  reportConnectionSuccess();
  expect(isOnline()).toBe(true);
  expect(signal?.aborted).toBe(true);
  expect(reconnect).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(120000);
  expect(fetch).toHaveBeenCalledOnce();
});

it.each([AxiosError.ERR_NETWORK, AxiosError.ECONNABORTED])(
  'checks the failed auth service after %s before reopening an expired session',
  async (code) => {
    vi.useFakeTimers();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const fetch = vi.fn().mockRejectedValue(new TypeError('Auth unreachable'));
    vi.stubGlobal('fetch', fetch);
    reportConnectionFailure(
      new AxiosError('network', code, {
        headers: new AxiosHeaders(),
        baseURL: '/api',
        url: '/oauth/token?grant_type=password',
        session: false,
      }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledWith(
      '/api/oauth/token',
      expect.objectContaining({ cache: 'no-store', credentials: 'omit' }),
    );
    expect(fetch.mock.calls[0][1].headers?.Authorization).toBeUndefined();
    expect(isOnline()).toBe(false);
    reportConnectionSuccess('/localeSettings');
    expect(isOnline()).toBe(false);
    fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized' }),
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(isOnline()).toBe(true);
  },
);
