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

export type SyncPhase = 'idle' | 'syncing' | 'session' | 'unsupported' | 'receipt' | 'failed';
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
