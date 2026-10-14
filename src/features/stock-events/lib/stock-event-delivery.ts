import { liveQuery } from 'dexie';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type { StockEventReceipt } from '@/features/stock-events/lib/stock-event-sync';
import { getLocalDb } from '@/integrations/local-db';
import { wakeStockEventSync } from '@/lib/device-event-status';
import { isOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const foregroundStockEvents = new Set<string>();
export function waitForStockEventReceipt(
  event: QueuedStockEvent,
): Promise<StockEventReceipt | undefined> {
  if (!isOnline()) return Promise.resolve(undefined);
  const db = getLocalDb();
  const scope = getSessionScope();
  foregroundStockEvents.add(event.localEventId);
  return new Promise((resolve) => {
    let sending = false;
    const finish = (receipt?: StockEventReceipt) => {
      clearTimeout(timer);
      subscription.unsubscribe();
      foregroundStockEvents.delete(event.localEventId);
      resolve(receipt);
    };
    const timer = setTimeout(() => finish(), 1500);
    const subscription = liveQuery(async () => {
      assertSessionScope(scope);
      const receipt = await db
        .table<StockEventReceipt>('stockEventReceipts')
        .get([event.draftId, event.revision]);
      assertSessionScope(scope);
      const row = await db.table<QueuedStockEvent>('stockEventQueue').get(event.sequence);
      assertSessionScope(scope);
      return { receipt, row };
    }).subscribe({
      next: ({ receipt, row }) => {
        if (receipt || !row || row.status === 'uncertain' || (sending && row.status === 'queued')) {
          finish(receipt);
        } else if (row.status === 'sending') {
          sending = true;
          clearTimeout(timer);
        }
      },
      error: () => finish(),
    });
    wakeStockEventSync();
  });
}
