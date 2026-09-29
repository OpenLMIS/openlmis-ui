import { onlineManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOnline, seedOnline, useOnline } from '@/lib/online';

afterEach(() => onlineManager.setOnline(true));

describe('online', () => {
  it('starts from what the browser knows, since an app opened offline is never told', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    seedOnline();

    expect(isOnline()).toBe(false);
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
