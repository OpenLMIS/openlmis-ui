import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '@/features/auth/api/api';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { useLoginData } from '@/features/auth/store/login-data';
import { httpError, networkError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', async (original) => ({
  ...(await original<typeof import('@/features/auth/api/api')>()),
  login: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  useLoginData.getState().clearLoginData();
});

afterEach(() => vi.useRealTimers());

describe('useAuthActions', () => {
  it('keeps when the new token was due to expire', async () => {
    vi.useFakeTimers({ now: 1_000_000, toFake: ['Date'] });
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: 'token',
      token_type: 'bearer',
      expires_in: 1800,
      scope: 'read write',
      referenceDataUserId: 'ada-id',
      username: 'ada',
    });
    const { result } = renderHook(() => useAuthActions());

    await act(() => result.current.login({ username: 'ada', password: 'secret' }));

    expect(useLoginData.getState()).toMatchObject({
      accessToken: 'token',
      expiresAt: 1_000_000 + 1_800_000,
    });
  });

  it('signs out quietly when the server says the session had already ended', async () => {
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'ada-id', username: 'ada', accessToken: 'dead' });
    vi.mocked(authApi.logout).mockRejectedValue(httpError(401));
    const { result } = renderHook(() => useAuthActions());

    await act(() => result.current.logout());

    expect(useLoginData.getState().isAuthenticated).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('still reports a sign out the server could not complete', async () => {
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'ada-id', username: 'ada', accessToken: 'token' });
    vi.mocked(authApi.logout).mockRejectedValue(new Error('Network Error'));
    const { result } = renderHook(() => useAuthActions());

    await act(() => result.current.logout());

    expect(useLoginData.getState().isAuthenticated).toBe(false);
    expect(toast.error).toHaveBeenCalledOnce();
  });

  it('says the server could not be reached when signing in offline, not that the password is wrong', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(authApi.login).mockRejectedValue(networkError());
    const { result } = renderHook(() => useAuthActions());

    await act(() => result.current.login({ username: 'ada', password: 'secret' }));

    expect(toast.error).toHaveBeenCalledWith('auth.login-error-title', {
      description: 'session.cannot-connect',
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('signs out offline without an error, since the user was warned and agreed', async () => {
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'ada-id', username: 'ada', accessToken: 'token' });
    vi.mocked(authApi.logout).mockRejectedValue(networkError());
    const { result } = renderHook(() => useAuthActions());

    await act(() => result.current.logout());

    expect(useLoginData.getState().isAuthenticated).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
