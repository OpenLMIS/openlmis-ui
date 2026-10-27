import { useSyncExternalStore } from 'react';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';

export { SessionEndedError };

let scope = 0;
const listeners = new Set<() => void>();

useLoginData.subscribe((state, previous) => {
  if (state.referenceDataUserId === previous.referenceDataUserId) return;
  scope += 1;
  for (const listener of listeners) listener();
});

export function getSessionScope() {
  return scope;
}

export function assertSessionScope(expected: number) {
  if (expected !== scope) throw new SessionEndedError();
}

export function subscribeSessionScope(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSessionScope() {
  return useSyncExternalStore(subscribeSessionScope, getSessionScope);
}

export function isSessionExpired() {
  return useLoginData.getState().expired;
}

export function getSessionUserId() {
  return useLoginData.getState().referenceDataUserId;
}

export function getSessionAccessToken() {
  return useLoginData.getState().accessToken;
}

export function isSessionAuthenticated() {
  return useLoginData.getState().isAuthenticated;
}
