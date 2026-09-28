import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncOtherTab, useLoginData } from '@/features/auth/store/login-data';

const ada = { referenceDataUserId: 'ada-id', username: 'ada', accessToken: 'ada-token' };

beforeEach(() => {
  localStorage.clear();
  useLoginData.getState().clearLoginData();
});

describe('useLoginData', () => {
  it('keeps the user but drops the token when the session expires', () => {
    useLoginData.getState().setLoginData(ada);

    useLoginData.getState().expireSession();

    expect(useLoginData.getState()).toMatchObject({
      referenceDataUserId: 'ada-id',
      username: 'ada',
      accessToken: null,
      isAuthenticated: true,
      expired: true,
    });
  });

  it('does nothing when there is no session to expire', () => {
    useLoginData.getState().expireSession();

    expect(useLoginData.getState()).toMatchObject({ isAuthenticated: false, expired: false });
  });

  it('records when the token was due to expire and clears the expired state on sign in', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    useLoginData.getState().setLoginData(ada);
    useLoginData.getState().expireSession();

    useLoginData.getState().setLoginData({ ...ada, expiresIn: 1800 });

    expect(useLoginData.getState()).toMatchObject({
      accessToken: 'ada-token',
      expired: false,
      expiresAt: 1_000_000 + 1_800_000,
    });
    vi.useRealTimers();
  });

  it('restores a session saved before the expiry fields existed', async () => {
    localStorage.setItem(
      'login-data-storage',
      JSON.stringify({
        state: { ...ada, isAuthenticated: true, sessionSource: 'own' },
        version: 0,
      }),
    );

    await useLoginData.persist.rehydrate();

    expect(useLoginData.getState()).toMatchObject({
      accessToken: 'ada-token',
      isAuthenticated: true,
      expired: false,
      expiresAt: null,
    });
  });
});

/** What another tab leaves in the shared storage after changing its session. */
function otherTabSaves(state: Partial<ReturnType<typeof useLoginData.getState>>) {
  const saved = { ...useLoginData.getState(), ...state };
  localStorage.setItem('login-data-storage', JSON.stringify({ state: saved, version: 0 }));
}

describe('syncOtherTab', () => {
  it('signs this tab out when another one signs out', async () => {
    useLoginData.getState().setLoginData(ada);
    otherTabSaves({
      referenceDataUserId: null,
      username: null,
      accessToken: null,
      isAuthenticated: false,
      sessionSource: null,
    });

    await syncOtherTab('login-data-storage');

    expect(useLoginData.getState().isAuthenticated).toBe(false);
  });

  it('carries on here once another tab signs in again', async () => {
    useLoginData.getState().setLoginData(ada);
    useLoginData.getState().expireSession();
    otherTabSaves({ accessToken: 'new-token', expired: false });

    await syncOtherTab('login-data-storage');

    expect(useLoginData.getState()).toMatchObject({ accessToken: 'new-token', expired: false });
  });

  it('saves our session again when the legacy UI wipes the storage', async () => {
    useLoginData.getState().setLoginData(ada);
    localStorage.clear();

    await syncOtherTab(null);

    expect(useLoginData.getState().isAuthenticated).toBe(true);
    expect(localStorage.getItem('login-data-storage')).toContain('ada-token');
  });
});
