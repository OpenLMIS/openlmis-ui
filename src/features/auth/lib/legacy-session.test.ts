import { beforeEach, describe, expect, it } from 'vitest';
import { clearLegacySession, readLegacySession } from '@/features/auth/lib/legacy-session';
import { waitForSession } from '@/features/auth/lib/session';
import { syncLegacySession, useLoginData } from '@/features/auth/store/login-data';

function signInLegacy(token: string, username = 'administrator') {
  localStorage.setItem('openlmis.ACCESS_TOKEN', token);
  localStorage.setItem('openlmis.USER_ID', 'legacy-user-id');
  localStorage.setItem('openlmis.USERNAME', username);
}

function signOutLegacy() {
  for (const key of ['ACCESS_TOKEN', 'USER_ID', 'USERNAME', 'ROLE_ASSIGNMENTS']) {
    localStorage.removeItem(`openlmis.${key}`);
  }
}

beforeEach(() => {
  localStorage.clear();
  useLoginData.getState().clearLoginData();
});

describe('readLegacySession', () => {
  it('reads the session the AngularJS UI left behind', () => {
    signInLegacy('legacy-token');

    expect(readLegacySession()).toEqual({
      accessToken: 'legacy-token',
      referenceDataUserId: 'legacy-user-id',
      username: 'administrator',
    });
  });

  it('unwraps a JSON-encoded token', () => {
    signInLegacy('"quoted-token"');

    expect(readLegacySession()?.accessToken).toBe('quoted-token');
  });

  it('waits until the legacy UI has written the whole session, not just the token', () => {
    localStorage.setItem('openlmis.ACCESS_TOKEN', 'legacy-token');
    expect(readLegacySession()).toBeNull();

    localStorage.setItem('openlmis.USER_ID', 'legacy-user-id');
    expect(readLegacySession()).toBeNull();
  });

  it('returns null when the legacy UI is signed out', () => {
    expect(readLegacySession()).toBeNull();
  });

  it('treats an empty token as signed out', () => {
    localStorage.setItem('openlmis.ACCESS_TOKEN', '   ');

    expect(readLegacySession()).toBeNull();
  });

  it('ignores unprefixed keys', () => {
    localStorage.setItem('ACCESS_TOKEN', 'wrong-prefix');

    expect(readLegacySession()).toBeNull();
  });
});

describe('clearLegacySession', () => {
  it('removes every legacy key', () => {
    signInLegacy('legacy-token');
    localStorage.setItem('openlmis.ROLE_ASSIGNMENTS', '[]');
    localStorage.setItem('openlmis.current_locale', 'en');

    clearLegacySession();

    expect(readLegacySession()).toBeNull();
    expect(localStorage.getItem('openlmis.ROLE_ASSIGNMENTS')).toBeNull();
    // Preferences are not session state, so they survive.
    expect(localStorage.getItem('openlmis.current_locale')).toBe('en');
  });
});

describe('syncLegacySession', () => {
  it('adopts the legacy session when we have none', () => {
    signInLegacy('legacy-token');

    expect(syncLegacySession()).toBe(true);
    expect(useLoginData.getState().isAuthenticated).toBe(true);
    expect(useLoginData.getState().accessToken).toBe('legacy-token');
    expect(useLoginData.getState().sessionSource).toBe('legacy');
  });

  it('asks to sign in again when the legacy UI signs out, so the page is not lost', () => {
    signInLegacy('legacy-token');
    syncLegacySession();

    signOutLegacy();

    expect(syncLegacySession()).toBe(true);
    expect(useLoginData.getState()).toMatchObject({ isAuthenticated: true, expired: true });
  });

  it('does not bring an expired session back with the token that expired', () => {
    signInLegacy('dead-token');
    syncLegacySession();
    useLoginData.getState().expireSession();

    expect(syncLegacySession()).toBe(false);
    expect(useLoginData.getState().expired).toBe(true);
  });

  it('holds a changed legacy token until its identity is confirmed', () => {
    signInLegacy('first-token', 'administrator');
    syncLegacySession();

    signInLegacy('second-token', 'someone-else');

    expect(syncLegacySession()).toBe(true);
    expect(useLoginData.getState().accessToken).toBe('first-token');
    expect(useLoginData.getState().expired).toBe(true);
  });

  it('leaves a session we established ourselves alone', () => {
    useLoginData.getState().setLoginData({
      accessToken: 'our-token',
      referenceDataUserId: 'our-id',
      username: 'ours',
    });
    signInLegacy('legacy-token');

    expect(syncLegacySession()).toBe(false);
    expect(useLoginData.getState().accessToken).toBe('our-token');
  });

  it('does not sign us out of our own session when the legacy UI signs out', () => {
    useLoginData.getState().setLoginData({
      accessToken: 'our-token',
      referenceDataUserId: 'our-id',
      username: 'ours',
    });
    signOutLegacy();

    expect(syncLegacySession()).toBe(false);
    expect(useLoginData.getState().isAuthenticated).toBe(true);
  });

  it('keeps the same-user draft scope while requiring an unambiguous sign in', async () => {
    signInLegacy('first-token');
    syncLegacySession();
    useLoginData.getState().expireSession();
    const waiting = waitForSession('legacy-user-id');

    signInLegacy('second-token');

    expect(syncLegacySession()).toBe(false);
    expect(useLoginData.getState().accessToken).toBe('first-token');
    expect(useLoginData.getState().expired).toBe(true);
    useLoginData.getState().setLoginData({
      accessToken: 'second-token',
      referenceDataUserId: 'legacy-user-id',
      username: 'administrator',
    });
    await expect(waiting).resolves.toBe('second-token');
  });

  it('is a no-op when neither side is signed in', () => {
    expect(syncLegacySession()).toBe(false);
    expect(useLoginData.getState().isAuthenticated).toBe(false);
  });
});
