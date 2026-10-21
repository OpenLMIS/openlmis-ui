import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type { StockEventSyncError } from '@/features/stock-events/lib/stock-event-sync';
import { getLocalDb, getLocalDbUserId, LOCAL_TABLES } from '@/integrations/local-db';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export async function hasOwnDeviceEvents() {
  let userId: string;
  try {
    userId = getLocalDbUserId();
  } catch {
    return false;
  }
  const scope = getSessionScope();
  const db = getLocalDb();
  const counts = await Promise.all([
    db
      .table<QueuedStockEvent>(LOCAL_TABLES.stockEventQueue)
      .filter((event) => event.userId === userId)
      .count(),
    db
      .table<StockEventSyncError>(LOCAL_TABLES.stockEventSyncErrors)
      .filter(
        (error) =>
          error.event.userId === userId &&
          !error.dismissedAt &&
          (!error.resolvedAt || error.category !== 'uncertain'),
      )
      .count(),
  ]);
  assertSessionScope(scope);
  return counts.some((count) => count > 0);
}
