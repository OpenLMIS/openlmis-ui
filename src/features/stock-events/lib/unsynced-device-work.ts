import { useLoginData } from '@/features/auth/store/login-data';
import type { InventoryLocalCopy } from '@/features/stock-events/lib/physical-inventory-local';
import type { StockEventDraft } from '@/features/stock-events/lib/stock-event-local';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type { StockEventSyncError } from '@/features/stock-events/lib/stock-event-sync';
import { getLocalDb } from '@/integrations/local-db';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export async function countUnsyncedDeviceWork() {
  if (!useLoginData.getState().referenceDataUserId) return 0;
  const scope = getSessionScope();
  const db = getLocalDb();
  return db.transaction(
    'r',
    ['stockEventDrafts', 'stockEventQueue', 'stockEventSyncErrors', 'physicalInventoryDrafts'],
    async () => {
      const drafts = await db.table<StockEventDraft>('stockEventDrafts').toArray();
      const queue = await db.table<QueuedStockEvent>('stockEventQueue').toArray();
      const errors = await db.table<StockEventSyncError>('stockEventSyncErrors').toArray();
      const inventories = await db.table<InventoryLocalCopy>('physicalInventoryDrafts').toArray();
      assertSessionScope(scope);
      const events = new Set([
        ...queue.map((row) => row.localEventId),
        ...errors
          .filter((row) => !row.resolvedAt && !row.dismissedAt)
          .map((row) => row.localEventId),
      ]);
      return (
        events.size +
        drafts.filter((row) => ['editing', 'archived'].includes(row.state) && row.lines.length > 0)
          .length +
        inventories.filter((row) => row.modified).length
      );
    },
  );
}
