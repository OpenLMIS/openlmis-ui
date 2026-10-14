import { useSyncExternalStore } from 'react';
import { getSessionScope } from '@/lib/session-scope';

let queued: { count: number; scope: number } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
export function announceQueuedEvents(count: number) {
  clearTimeout(timer);
  queued = { count, scope: getSessionScope() };
  for (const listener of listeners) listener();
  timer = setTimeout(() => {
    queued = null;
    for (const listener of listeners) listener();
  }, 4000);
}
export function useQueuedAnnouncement() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => (queued?.scope === getSessionScope() ? queued : null),
  );
}
