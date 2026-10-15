import { useLoginData } from '@/features/auth/store/login-data';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type { StockEventSyncError } from '@/features/stock-events/lib/stock-event-sync';
import { getLocalDb } from '@/integrations/local-db';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export async function hasOwnDeviceEvents() {
  const userId = useLoginData.getState().referenceDataUserId;
  if (!userId) return false;
  const scope = getSessionScope();
  const db = getLocalDb();
  const counts = await Promise.all([
    db
      .table<QueuedStockEvent>('stockEventQueue')
      .filter((event) => event.userId === userId)
      .count(),
    db
      .table<StockEventSyncError>('stockEventSyncErrors')
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
