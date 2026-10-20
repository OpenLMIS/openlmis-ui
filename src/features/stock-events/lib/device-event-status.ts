import { create } from 'zustand';
import { createNoticeCountdown } from '@/lib/notice-countdown';
import { createScopedAnnouncement } from '@/lib/scoped-announcement';
import { getSessionScope } from '@/lib/session-scope';

const queued = createScopedAnnouncement<{ count: number }>();
export const announceQueuedEvents = (count: number) => queued.announce({ count });
export const useQueuedAnnouncement = queued.useAnnouncement;

type SyncPhase = 'idle' | 'syncing' | 'complete' | 'session' | 'unsupported' | 'receipt' | 'failed';
const useSync = create<{ phase: SyncPhase; scope: number }>(() => ({
  phase: 'idle',
  scope: getSessionScope(),
}));
export const syncCountdown = createNoticeCountdown(() => {
  if (useSync.getState().scope === getSessionScope()) setSyncPhase('idle');
});
const phaseFor = (state: ReturnType<typeof useSync.getState>) =>
  state.scope === getSessionScope() ? state.phase : 'idle';
export const getSyncPhase = () => phaseFor(useSync.getState());
export function setSyncPhase(phase: SyncPhase) {
  const scope = getSessionScope();
  const sync = useSync.getState();
  if (sync.phase === phase && sync.scope === scope) return;
  syncCountdown.stop();
  useSync.setState({ phase, scope });
  if (phase === 'complete') syncCountdown.start();
}
export const useSyncPhase = () => useSync(phaseFor);
let wake: (() => void) | undefined;
export const wakeStockEventSync = () => wake?.();
export function setSyncWake(callback?: () => void) {
  wake = callback;
}

const preparationListeners = new Set<() => void>();
let preparation = { scope: getSessionScope(), count: 0 };
export const isSyncPreparing = () =>
  preparation.scope === getSessionScope() && preparation.count > 0;
export function subscribeSyncPreparation(listener: () => void) {
  preparationListeners.add(listener);
  return () => {
    preparationListeners.delete(listener);
  };
}
export function beginSyncPreparation() {
  const scope = getSessionScope();
  if (preparation.scope !== scope) preparation = { scope, count: 0 };
  preparation.count++;
  for (const listener of preparationListeners) listener();
  return () => {
    if (preparation.scope !== scope) return;
    preparation.count--;
    for (const listener of preparationListeners) listener();
  };
}
