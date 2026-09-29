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

afterEach(() => vi.useRealTimers());

describe('online', () => {
  it('starts from what the browser knows, since an app opened offline is never told', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    seedOnline();

    expect(isOnline()).toBe(false);
  });

  it('hears the connection come back while the app is still starting', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    seedOnline();

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
