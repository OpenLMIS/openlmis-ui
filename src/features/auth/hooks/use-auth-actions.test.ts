import { act, renderHook } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '@/features/auth/api/api';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { useLoginData } from '@/features/auth/store/login-data';

vi.mock('@/features/auth/api/api', () => ({ login: vi.fn(), logout: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const unauthorized = new AxiosError('failed', '401', undefined, undefined, {
  status: 401,
  statusText: '',
  data: {},
  headers: {},
  config: { headers: new AxiosHeaders() },
});

beforeEach(() => {
  useLoginData.getState().clearLoginData();
});

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
    vi.useRealTimers();
  });

  it('signs out quietly when the server says the session had already ended', async () => {
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'ada-id', username: 'ada', accessToken: 'dead' });
    vi.mocked(authApi.logout).mockRejectedValue(unauthorized);
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
});
