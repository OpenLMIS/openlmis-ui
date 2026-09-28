import { beforeEach, describe, expect, it } from 'vitest';
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
