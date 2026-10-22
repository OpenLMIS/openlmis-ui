import { expect, it } from 'vitest';
import { errorState, pendingState, tabOf } from '@/features/stock-events/lib/offline-event-tabs';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type {
  DeviceEvent,
  StockEventSyncError,
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

it('distinguishes waiting, held, sending and queued events', () => {
  const blocked = new Set(['home:one']);
  expect(pendingState(queued(1), blocked)).toBe('waiting');
  expect(pendingState(queued(2, { pauseReason: 'access-changed' }), blocked)).toBe('held');
  expect(pendingState(queued(3, { pauseReason: 'draft-changed' }), blocked)).toBe('held');
  expect(pendingState(queued(4, { status: 'sending' }), blocked)).toBe('sending');
  expect(pendingState(queued(5, { programId: 'other' }), blocked)).toBe('queued');
});
