import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import { useSessionMutation } from '@/hooks/use-session-mutation';

const ada = { referenceDataUserId: 'ada', username: 'ada', accessToken: 'token' };
const alan = { referenceDataUserId: 'alan', username: 'alan', accessToken: 'other' };
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

beforeEach(() => useLoginData.getState().setLoginData(ada));

describe('useSessionMutation', () => {
  it('refuses a draft callback retained across a user switch', async () => {
    const send = vi.fn(async () => 'saved');
    const { result } = renderHook(() => useSessionMutation({ mutationFn: send }), { wrapper });
    const save = result.current.mutateAsync;
    act(() => useLoginData.getState().setLoginData(alan));
    await expect(save()).rejects.toBeInstanceOf(SessionEndedError);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not publish a save completion into the next user cache or navigate', async () => {
    let release = () => {};
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();
    const { result } = renderHook(
      () =>
        useSessionMutation({
          mutationFn: () =>
            new Promise<string>((resolve) => {
              release = () => resolve('saved');
            }),
          onSuccess,
          onError,
          onSettled,
        }),
      { wrapper },
    );
    const saving = result.current.mutateAsync();
    const rejection = expect(saving).rejects.toBeInstanceOf(SessionEndedError);
    await waitFor(() => expect(result.current.isPending).toBe(true));
    act(() => useLoginData.getState().setLoginData(alan));
    release();
    await rejection;
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('keeps same-user saves valid through reauthentication', async () => {
    const send = vi.fn(async () => 'saved');
    const { result } = renderHook(() => useSessionMutation({ mutationFn: send }), { wrapper });
    act(() => {
      useLoginData.getState().expireSession();
      useLoginData.getState().setLoginData({ ...ada, accessToken: 'renewed' });
    });
    await expect(result.current.mutateAsync()).resolves.toBe('saved');
  });
});
