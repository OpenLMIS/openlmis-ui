import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

export type OfflineEventTab = 'pending' | 'errors' | 'synced';
export type PendingEventState =
  | { state: 'sending' | 'waiting' | 'queued' }
  | { state: 'held'; pauseReason: NonNullable<QueuedStockEvent['pauseReason']> };

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
  if (event.status === 'sending') return { state: 'sending' };
  if (event.pauseReason) return { state: 'held', pauseReason: event.pauseReason };
  if (blocked.has(`${event.facilityId}:${event.programId}`)) return { state: 'waiting' };
  return { state: 'queued' };
}

export function errorState(
  event: DeviceEvent,
): 'refused' | 'stock-changed' | 'uncertain' | 'copied' {
  if (event.status === 'refused' && event.error?.resolvedAt) return 'copied';
  if (event.status === 'uncertain') return 'uncertain';
  return event.error?.category === 'stock-changed' ? 'stock-changed' : 'refused';
}

export function comparePendingEvents(a: DeviceEvent, b: DeviceEvent): number {
  return a.sequence - b.sequence;
}

export function compareErrorEvents(a: DeviceEvent, b: DeviceEvent): number {
  return (a.error?.failedAt ?? 0) - (b.error?.failedAt ?? 0);
}

export function compareSyncedEvents(a: DeviceEvent, b: DeviceEvent): number {
  return (b.receipt?.acceptedAt ?? 0) - (a.receipt?.acceptedAt ?? 0);
}
