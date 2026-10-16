import { useSyncExternalStore } from 'react';
import { getSessionScope } from '@/lib/session-scope';

export function createScopedAnnouncement<T>() {
  let current: { value: T; scope: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    announce(value: T) {
      clearTimeout(timer);
      current = { value, scope: getSessionScope() };
      notify();
      timer = setTimeout(() => {
        current = null;
        notify();
      }, 4000);
    },
    useAnnouncement() {
      return useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        () => (current?.scope === getSessionScope() ? current.value : null),
      );
    },
  };
}
