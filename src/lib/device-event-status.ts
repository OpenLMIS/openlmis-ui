import { useSyncExternalStore } from 'react';
import { createScopedAnnouncement } from '@/lib/scoped-announcement';
import { getSessionScope } from '@/lib/session-scope';

const queued = createScopedAnnouncement<{ count: number }>();
export const announceQueuedEvents = (count: number) => queued.announce({ count });
export const useQueuedAnnouncement = queued.useAnnouncement;
const listeners = new Set<() => void>();

type SyncPhase = 'idle' | 'syncing' | 'session' | 'unsupported' | 'receipt' | 'failed';
let sync: { phase: SyncPhase; scope: number } = { phase: 'idle', scope: getSessionScope() };
export function setSyncPhase(phase: SyncPhase) {
  if (sync.phase === phase && sync.scope === getSessionScope()) return;
  sync = { phase, scope: getSessionScope() };
  for (const listener of listeners) listener();
}
export function useSyncPhase() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => (sync.scope === getSessionScope() ? sync.phase : 'idle'),
  );
}
let wake: (() => void) | undefined;
export const wakeStockEventSync = () => wake?.();
export function setSyncWake(callback?: () => void) {
  wake = callback;
}
