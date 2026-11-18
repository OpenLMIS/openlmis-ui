import { onlineManager } from '@tanstack/react-query';
import { isCancel } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionEndedError, waitForSession } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';

const ada = { referenceDataUserId: 'ada-id', username: 'ada', accessToken: 'ada-token' };

beforeEach(() => {
  useLoginData.getState().clearLoginData();
  useLoginData.getState().setLoginData(ada);
});

describe('waitForSession', () => {
  it('resolves at once with the token while the session is live', async () => {
    await expect(waitForSession('ada-id')).resolves.toBe('ada-token');
  });

  it('holds every waiter until the same user signs in again, then gives them the new token', async () => {
    useLoginData.getState().expireSession();
    const first = waitForSession('ada-id');
    const second = waitForSession('ada-id');

    useLoginData.getState().setLoginData({ ...ada, accessToken: 'new-token' });

    await expect(first).resolves.toBe('new-token');
    await expect(second).resolves.toBe('new-token');
  });

  it('gives up when the user signs out instead', async () => {
    useLoginData.getState().expireSession();
    const waiting = waitForSession('ada-id');

    useLoginData.getState().clearLoginData();

    await expect(waiting).rejects.toBeInstanceOf(SessionEndedError);
  });

  it('gives up when someone else signs in, so nothing is sent as them', async () => {
    useLoginData.getState().expireSession();
    const waiting = waitForSession('ada-id');

    useLoginData.getState().setLoginData({
      referenceDataUserId: 'alan-id',
      username: 'alan',
      accessToken: 'alan-token',
    });

    await expect(waiting).rejects.toBeInstanceOf(SessionEndedError);
  });
});

describe('waitForSession with a request signal', () => {
  const trackSubscriptions = () => {
    const released = { login: 0, online: 0 };
    const login = useLoginData.subscribe.bind(useLoginData);
    const online = onlineManager.subscribe.bind(onlineManager);
    vi.spyOn(useLoginData, 'subscribe').mockImplementation((listener) => {
      const unsubscribe = login(listener);
      return () => {
        released.login += 1;
        unsubscribe();
      };
    });
    vi.spyOn(onlineManager, 'subscribe').mockImplementation((listener) => {
      const unsubscribe = online(listener);
      return () => {
        released.online += 1;
        unsubscribe();
      };
    });
    return released;
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cancels an expired wait when the request is aborted and stops listening', async () => {
    useLoginData.getState().expireSession();
    const released = trackSubscriptions();
    const controller = new AbortController();
    const waiting = waitForSession('ada-id', controller.signal);

    controller.abort();

    await expect(waiting).rejects.toSatisfy(isCancel);
    expect(released).toEqual({ login: 1, online: 1 });
  });

  it('refuses at once without listening when the request was already aborted', async () => {
    useLoginData.getState().expireSession();
    const released = trackSubscriptions();
    const controller = new AbortController();
    controller.abort();

    await expect(waitForSession('ada-id', controller.signal)).rejects.toSatisfy(isCancel);
    expect(useLoginData.subscribe).not.toHaveBeenCalled();
    expect(released).toEqual({ login: 0, online: 0 });
  });
});
