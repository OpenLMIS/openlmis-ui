import { onlineManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dismissBackOnline,
  isOnline,
  seedOnline,
  useBackOnline,
  useOnline,
  useOnReconnect,
} from '@/lib/online';

afterEach(() => {
  vi.useRealTimers();
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
      .mockResolvedValueOnce({ ok: true });
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
    await vi.advanceTimersByTimeAsync(1000);
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
