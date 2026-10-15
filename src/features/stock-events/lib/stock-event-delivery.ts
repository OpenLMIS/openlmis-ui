import { liveQuery } from 'dexie';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type {
  StockEventReceipt,
  StockEventSyncError,
} from '@/features/stock-events/lib/stock-event-sync';
import { getLocalDb } from '@/integrations/local-db';
import { wakeStockEventSync } from '@/lib/device-event-status';
import { isOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export type StockEventDelivery =
  | { kind: 'accepted'; receipt: StockEventReceipt }
  | { kind: 'refused'; error: StockEventSyncError }
  | { kind: 'uncertain' }
  | { kind: 'blocked' }
  | { kind: 'held'; reason: NonNullable<QueuedStockEvent['pauseReason']> }
  | { kind: 'queued' };
export const foregroundStockEvents = new Set<string>();
export function waitForStockEventReceipt(event: QueuedStockEvent): Promise<StockEventDelivery> {
  if (!isOnline()) return Promise.resolve({ kind: 'queued' });
  const db = getLocalDb();
  const scope = getSessionScope();
  foregroundStockEvents.add(event.localEventId);
  return new Promise((resolve) => {
    let sending = false;
    let done = false;
    const finish = (outcome: StockEventDelivery) => {
      if (done) return;
      done = true;
      clearTimeout(startTimer);
      clearTimeout(deadline);
      subscription.unsubscribe();
      foregroundStockEvents.delete(event.localEventId);
      resolve(outcome);
    };
    const startTimer = setTimeout(() => finish({ kind: 'queued' }), 1500);
    const deadline = setTimeout(() => finish({ kind: sending ? 'uncertain' : 'queued' }), 65_000);
    const subscription = liveQuery(async () => {
      assertSessionScope(scope);
      return db.transaction(
        'r',
        ['stockEventReceipts', 'stockEventSyncErrors', 'stockEventQueue'],
        async () => {
          const receipt = await db
            .table<StockEventReceipt>('stockEventReceipts')
            .get([event.draftId, event.revision]);
          const error = await db
            .table<StockEventSyncError>('stockEventSyncErrors')
            .get(event.localEventId);
          const row = await db.table<QueuedStockEvent>('stockEventQueue').get(event.sequence);
          const earlier = await db
            .table<QueuedStockEvent>('stockEventQueue')
            .filter(
              (candidate) =>
                candidate.facilityId === event.facilityId &&
                candidate.programId === event.programId &&
                candidate.sequence < event.sequence &&
                (candidate.status === 'uncertain' || !!candidate.pauseReason),
            )
            .first();
          assertSessionScope(scope);
          return { receipt, error, row, earlier };
        },
      );
    }).subscribe({
      next: ({ receipt, error, row, earlier }) => {
        if (receipt) finish({ kind: 'accepted', receipt });
        else if (error && !error.resolvedAt && error.category !== 'uncertain')
          finish({ kind: 'refused', error });
        else if (row?.status === 'uncertain') finish({ kind: 'uncertain' });
        else if (row?.pauseReason) finish({ kind: 'held', reason: row.pauseReason });
        else if (earlier) finish({ kind: 'blocked' });
        else if (!row || (sending && row.status === 'queued')) finish({ kind: 'queued' });
        else if (row.status === 'sending') {
          sending = true;
          clearTimeout(startTimer);
        }
      },
      error: () => finish({ kind: sending ? 'uncertain' : 'queued' }),
    });
    wakeStockEventSync();
  });
}
