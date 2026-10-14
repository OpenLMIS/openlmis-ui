import { useSyncExternalStore } from 'react';
import { getSessionScope } from '@/lib/session-scope';

type Announcement = {
  key:
    | 'stock-events.draft-failed'
    | 'stock-events.draft-saved'
    | 'stock-events.draft-copy-saved'
    | 'stock-events.draft-restored';
  scope: number;
} | null;
let announcement: Announcement = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
export function announceDeviceSave(key: NonNullable<Announcement>['key']) {
  clearTimeout(timer);
  announcement = { key, scope: getSessionScope() };
  for (const listener of listeners) listener();
  timer = setTimeout(() => {
    announcement = null;
    for (const listener of listeners) listener();
  }, 4000);
}
export function useDeviceSaveAnnouncement() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => (announcement?.scope === getSessionScope() ? announcement.key : null),
  );
}
