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
  it.each([alan, ada])('refuses a retained draft after switching to $username', async (next) => {
    const send = vi.fn(async () => 'saved');
    const { result } = renderHook(() => useSessionMutation({ mutationFn: send }), { wrapper });
    const save = result.current.mutateAsync;
    act(() => {
      useLoginData.getState().setLoginData(alan);
      useLoginData.getState().setLoginData(next);
    });
    await expect(save()).rejects.toBeInstanceOf(SessionEndedError);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['success', 'failure'])(
    'does not publish a save %s into the next user cache or navigate',
    async (outcome) => {
      const finish = Promise.withResolvers<string>();
      const send = vi.fn(() => finish.promise);
      const failure = new Error('Save refused');
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const onSettled = vi.fn();
      const { result } = renderHook(
        () =>
          useSessionMutation({
            mutationFn: send,
            onSuccess,
            onError,
            onSettled,
          }),
        { wrapper },
      );
      const saving = result.current.mutateAsync();
      const rejection =
        outcome === 'success'
          ? expect(saving).rejects.toBeInstanceOf(SessionEndedError)
          : expect(saving).rejects.toBe(failure);
      await waitFor(() => expect(send).toHaveBeenCalledOnce());
      act(() => useLoginData.getState().setLoginData(alan));
      if (outcome === 'success') finish.resolve('saved');
      else finish.reject(failure);
      await rejection;
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(onSettled).not.toHaveBeenCalled();
    },
  );

  it('does not run a per-call completion after an async settlement crosses identities', async () => {
    let release = () => {};
    const started = vi.fn();
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useSessionMutation({
          mutationFn: async () => 'saved',
          onSettled: async () => {
            started();
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          },
        }),
      { wrapper },
    );
    const saving = result.current.mutateAsync(undefined, { onSuccess }).then(
      () => null,
      (error: unknown) => error,
    );
    await waitFor(() => expect(started).toHaveBeenCalledOnce());
    act(() => useLoginData.getState().setLoginData(alan));
    release();
    expect(await saving).toBeInstanceOf(SessionEndedError);
    expect(onSuccess).not.toHaveBeenCalled();
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
