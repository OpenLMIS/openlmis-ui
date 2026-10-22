import { expect, it } from 'vitest';
import {
  compareErrorEvents,
  comparePendingEvents,
  compareSyncedEvents,
  errorState,
  pendingState,
  tabOf,
} from '@/features/stock-events/lib/offline-event-tabs';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import {
  blockedScopes,
  type DeviceEvent,
  type StockEventSyncError,
} from '@/features/stock-events/lib/stock-event-sync';

function queued(sequence: number, changes: Partial<QueuedStockEvent> = {}): QueuedStockEvent {
  return {
    sequence,
    localEventId: `event-${sequence}`,
    draftId: `draft-${sequence}`,
    revision: 1,
    kind: 'adjustment',
    facilityId: 'home',
    programId: 'one',
    userId: 'user',
    lines: [],
    facility: { id: 'home', code: 'H', name: 'Home' },
    program: { id: 'one', code: 'one', name: 'One' },
    payload: { facilityId: 'home', programId: 'one', lineItems: [] },
    postBody: '{}',
    queuedAt: 100 - sequence,
    status: 'queued',
    ...changes,
  };
}
function failed(
  sequence: number,
  category: StockEventSyncError['category'],
  failedAt: number,
  resolvedAt?: number,
): DeviceEvent {
  const event = queued(sequence, { attemptId: `attempt-${sequence}` });
  return {
    ...event,
    status: category === 'uncertain' ? 'uncertain' : 'refused',
    error: {
      localEventId: event.localEventId,
      facilityId: event.facilityId,
      programId: event.programId,
      event,
      category,
      message: '',
      failedAt,
      resolvedAt,
    },
  };
}
function accepted(sequence: number, acceptedAt: number): DeviceEvent {
  const event = queued(sequence);
  return {
    ...event,
    status: 'accepted',
    receipt: {
      draftId: event.draftId,
      revision: event.revision,
      localEventId: event.localEventId,
      acceptedAt,
      source: 'server',
    },
  };
}

it('separates pending attempts, every failure category, copied refusals and receipts', () => {
  const events = [
    queued(1),
    queued(2, { status: 'sending' }),
    queued(3, { attemptId: 'send-again' }),
    failed(4, 'uncertain', 10),
    failed(5, 'refused', 20),
    failed(6, 'stock-changed', 30),
    failed(7, 'refused', 40, 50),
    failed(8, 'stock-changed', 50, 60),
    accepted(9, 60),
  ];
  expect(events.map(tabOf)).toEqual([
    'pending',
    'pending',
    'pending',
    'errors',
    'errors',
    'errors',
    'errors',
    'errors',
    'synced',
  ]);
  expect(events.slice(3, 8).map(errorState)).toEqual([
    'uncertain',
    'refused',
    'stock-changed',
    'copied',
    'copied',
  ]);
});

it('uses all queue rows for scope barriers and distinguishes waiting from each own hold', () => {
  const earlier = queued(1);
  const paused = queued(2, { pauseReason: 'access-changed' });
  const uncertain = queued(3, { status: 'uncertain', programId: 'two' });
  const sending = queued(4, { status: 'sending', programId: 'three' });
  const refused = failed(5, 'refused', 10);
  refused.programId = 'four';
  const projections: DeviceEvent[] = [
    earlier,
    paused,
    uncertain,
    sending,
    refused,
    accepted(6, 20),
  ];
  const rows = projections.filter(
    (event): event is QueuedStockEvent =>
      event.status === 'queued' || event.status === 'sending' || event.status === 'uncertain',
  );
  const blocked = blockedScopes(rows);
  expect([...blocked]).toEqual(['home:one', 'home:two', 'home:three']);
  expect(pendingState(earlier, blocked)).toEqual({ state: 'waiting' });
  expect(pendingState(paused, blocked)).toEqual({
    state: 'held',
    pauseReason: 'access-changed',
  });
  expect(pendingState(queued(7, { pauseReason: 'draft-changed' }), blocked)).toEqual({
    state: 'held',
    pauseReason: 'draft-changed',
  });
  expect(pendingState(sending, blocked)).toEqual({ state: 'sending' });
  expect(pendingState(queued(8, { programId: 'four' }), blocked)).toEqual({ state: 'queued' });
  expect(pendingState(queued(9, { facilityId: 'other' }), blocked)).toEqual({ state: 'queued' });
});

it('orders pending by original sequence, failures oldest first and receipts newest first', () => {
  const pending = [queued(3), queued(1, { attemptId: 'send-again' }), queued(2)];
  expect(pending.toSorted(comparePendingEvents).map((event) => event.sequence)).toEqual([1, 2, 3]);
  const errors = [
    failed(1, 'refused', 30),
    failed(2, 'uncertain', 10),
    failed(3, 'refused', 20, 40),
  ];
  expect(errors.toSorted(compareErrorEvents).map((event) => event.sequence)).toEqual([2, 3, 1]);
  const synced = [accepted(1, 20), accepted(2, 30), accepted(3, 10)];
  expect(synced.toSorted(compareSyncedEvents).map((event) => event.sequence)).toEqual([2, 1, 3]);
});
