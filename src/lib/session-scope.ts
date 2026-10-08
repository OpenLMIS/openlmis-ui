import { useSyncExternalStore } from 'react';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';

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

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSessionScope() {
  return useSyncExternalStore(subscribe, getSessionScope);
}
