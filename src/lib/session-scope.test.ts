import { afterEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  assertSessionScope,
  getSessionAccessToken,
  getSessionScope,
  getSessionUserId,
  isSessionAuthenticated,
  isSessionExpired,
  SessionEndedError,
  subscribeSessionScope,
} from '@/lib/session-scope';

afterEach(() => useLoginData.getState().clearLoginData());

it('keeps the owner scope through expiry and renewal, and invalidates it when the owner changes', () => {
  const owner = { referenceDataUserId: 'owner', username: 'Owner', accessToken: 'first' };
  useLoginData.getState().setLoginData(owner);
  const scope = getSessionScope();
  const changed = vi.fn();
  const unsubscribe = subscribeSessionScope(changed);
  try {
    useLoginData.getState().expireSession();
    expect(isSessionExpired()).toBe(true);
    expect(isSessionAuthenticated()).toBe(true);
    expect(getSessionAccessToken()).toBe('first');
    useLoginData.getState().setLoginData({ ...owner, accessToken: 'renewed' });
    expect(getSessionUserId()).toBe('owner');
    expect(getSessionAccessToken()).toBe('renewed');
    expect(isSessionExpired()).toBe(false);
    expect(() => assertSessionScope(scope)).not.toThrow();
    expect(changed).not.toHaveBeenCalled();
    useLoginData.getState().setLoginData({ ...owner, referenceDataUserId: 'other' });
    expect(changed).toHaveBeenCalledOnce();
    expect(() => assertSessionScope(scope)).toThrow(SessionEndedError);
  } finally {
    unsubscribe();
  }
  useLoginData.getState().clearLoginData();
  expect(changed).toHaveBeenCalledOnce();
  expect(getSessionUserId()).toBeNull();
  expect(getSessionAccessToken()).toBeNull();
  expect(isSessionAuthenticated()).toBe(false);
});
