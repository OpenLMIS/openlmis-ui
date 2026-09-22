import { beforeEach, describe, expect, it } from 'vitest';
import { readLegacySession } from '@/features/auth/lib/legacy-session';
import { adoptLegacySession, useLoginData } from '@/features/auth/store/login-data';

beforeEach(() => {
  localStorage.clear();
  useLoginData.getState().clearLoginData();
});

describe('readLegacySession', () => {
  it('reads the session the AngularJS UI left behind', () => {
    localStorage.setItem('openlmis.ACCESS_TOKEN', 'legacy-token');
    localStorage.setItem('openlmis.USER_ID', 'user-uuid');
    localStorage.setItem('openlmis.USERNAME', 'administrator');

    expect(readLegacySession()).toEqual({
      accessToken: 'legacy-token',
      referenceDataUserId: 'user-uuid',
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

describe('adoptLegacySession', () => {
  it('signs us in from the legacy session', () => {
    localStorage.setItem('openlmis.ACCESS_TOKEN', 'legacy-token');
    localStorage.setItem('openlmis.USERNAME', 'administrator');

    expect(adoptLegacySession()).toBe(true);
    expect(useLoginData.getState().isAuthenticated).toBe(true);
    expect(useLoginData.getState().accessToken).toBe('legacy-token');
  });

  it('leaves an existing session alone', () => {
    useLoginData.getState().setLoginData({
      accessToken: 'our-token',
      referenceDataUserId: 'our-id',
      username: 'ours',
    });
    localStorage.setItem('openlmis.ACCESS_TOKEN', 'legacy-token');

    expect(adoptLegacySession()).toBe(false);
    expect(useLoginData.getState().accessToken).toBe('our-token');
  });

  it('does nothing when there is no legacy session', () => {
    expect(adoptLegacySession()).toBe(false);
    expect(useLoginData.getState().isAuthenticated).toBe(false);
  });
});
