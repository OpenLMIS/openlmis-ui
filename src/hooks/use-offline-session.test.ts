import { onlineManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { useOfflineSession } from '@/hooks/use-offline-session';

afterEach(() => {
  useLoginData.getState().clearLoginData();
  vi.useRealTimers();
});

it('warns near earliest expiry offline without expiring the session or blocking online work', () => {
  vi.useFakeTimers();
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'owner',
    username: 'owner',
    accessToken: 'token',
    expiresIn: 1800,
  });
  onlineManager.setOnline(false);
  const { result } = renderHook(useOfflineSession);
  expect(result.current).toBe(false);
  act(() => vi.advanceTimersByTime(29 * 60_000));
  expect(result.current).toBe(true);
  expect(useLoginData.getState().expired).toBe(false);
  act(() => onlineManager.setOnline(true));
  expect(result.current).toBe(false);
  expect(useLoginData.getState().isAuthenticated).toBe(true);
});
