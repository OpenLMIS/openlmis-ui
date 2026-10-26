import { isNewLot } from '@/features/stock-events/lib/event-form';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type {
  StockEventReceipt,
  StockEventSyncError,
} from '@/features/stock-events/lib/stock-event-sync';
import type { NewLot } from '@/features/stock-events/lib/types';
import { getLocalDb, getLocalDbUserId, LOCAL_TABLES, localTable } from '@/integrations/local-db';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export async function readDeviceNewLots(): Promise<NewLot[]> {
  const scope = getSessionScope();
  const userId = getLocalDbUserId();
  const queue = localTable<QueuedStockEvent>(LOCAL_TABLES.stockEventQueue);
  const errors = localTable<StockEventSyncError>(LOCAL_TABLES.stockEventSyncErrors);
  const receipts = localTable<StockEventReceipt>(LOCAL_TABLES.stockEventReceipts);
  const events = await getLocalDb().transaction('r', [queue, errors, receipts], async () => {
    const [queued, refused, accepted] = await Promise.all([
      queue.toArray(),
      errors.toArray(),
      receipts.toArray(),
    ]);
    return [
      ...queued,
      ...refused.flatMap(({ event, resolvedAt }) => (resolvedAt ? [] : [event])),
      ...accepted.flatMap(({ event }) => (event ? [event] : [])),
    ];
  });
  assertSessionScope(scope);
  const lots = events
    .filter((event) => event.userId === userId)
    .flatMap(({ lines }) => lines.flatMap(({ lot }) => (isNewLot(lot) ? [lot] : [])));
  return [
    ...new Map(
      lots.map((lot) => [
        JSON.stringify([lot.tradeItemId, lot.lotCode.toLowerCase(), lot.expirationDate ?? '']),
        lot,
      ]),
    ).values(),
  ];
}
