import { type DeviceEvent, scopeKey } from '@/features/stock-events/lib/stock-event-sync';

export type OfflineEventTab = 'pending' | 'errors' | 'synced';
export type PendingEventState = 'sending' | 'waiting' | 'queued' | 'held';

export function tabOf(event: DeviceEvent): OfflineEventTab {
  switch (event.status) {
    case 'queued':
    case 'sending':
      return 'pending';
    case 'uncertain':
    case 'refused':
      return 'errors';
    case 'accepted':
      return 'synced';
  }
}

export function pendingState(event: DeviceEvent, blocked: ReadonlySet<string>): PendingEventState {
  if (event.status === 'sending') return 'sending';
  if (event.pauseReason) return 'held';
  if (blocked.has(scopeKey(event))) return 'waiting';
  return 'queued';
}

export function errorState(
  event: DeviceEvent,
): 'refused' | 'stock-changed' | 'uncertain' | 'copied' {
  if (event.status === 'refused' && event.error?.resolvedAt) return 'copied';
  if (event.status === 'uncertain') return 'uncertain';
  return event.error?.category === 'stock-changed' ? 'stock-changed' : 'refused';
}
