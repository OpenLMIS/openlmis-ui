import { beforeEach, describe, expect, it } from 'vitest';
import { clearLegacySession, readLegacySession } from '@/features/auth/lib/legacy-session';
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
    localStorage.setItem('openlmis.ACCESS_TOKEN', '"quoted-token"');

    expect(readLegacySession()?.accessToken).toBe('quoted-token');
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

  it('signs us out when the legacy UI signs out', () => {
    signInLegacy('legacy-token');
    syncLegacySession();

    signOutLegacy();

    expect(syncLegacySession()).toBe(true);
    expect(useLoginData.getState().isAuthenticated).toBe(false);
    expect(useLoginData.getState().accessToken).toBeNull();
  });

  it('follows the legacy UI to a different user', () => {
    signInLegacy('first-token', 'administrator');
    syncLegacySession();

    signInLegacy('second-token', 'someone-else');

    expect(syncLegacySession()).toBe(true);
    expect(useLoginData.getState().accessToken).toBe('second-token');
    expect(useLoginData.getState().username).toBe('someone-else');
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

  it('is a no-op when neither side is signed in', () => {
    expect(syncLegacySession()).toBe(false);
    expect(useLoginData.getState().isAuthenticated).toBe(false);
  });
});
