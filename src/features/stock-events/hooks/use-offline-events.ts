import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { hasOwnDeviceEvents } from '@/features/stock-events/lib/device-event-access';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type {
  DeviceEvent,
  StockEventReceipt,
  StockEventSyncError,
} from '@/features/stock-events/lib/stock-event-sync';
import { getLocalDb } from '@/integrations/local-db';
import type { OfflineAccess } from '@/lib/offline-access';
import { type Permissions, parsePermissions } from '@/lib/permissions';
import { assertSessionScope, getSessionScope, useSessionScope } from '@/lib/session-scope';

export function useOfflineEvents(enabled = true, onlyIfPresent = false) {
  const scope = useSessionScope();
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    scope: number;
    attempt: number;
    events?: DeviceEvent[];
    hasDeviceEvents?: boolean;
    error?: unknown;
    permissions?: Permissions;
    permissionsFetchedAt?: number;
  }>({ scope, attempt: 0 });
  useEffect(() => {
    if (!enabled) return;
    const subscription = liveQuery(async () => {
      assertSessionScope(scope);
      const hasDeviceEvents = await hasOwnDeviceEvents();
      assertSessionScope(scope);
      if (onlyIfPresent && !hasDeviceEvents) return { events: [], hasDeviceEvents };
      const db = getLocalDb();
      const events = await db.transaction(
        'r',
        ['stockEventQueue', 'stockEventSyncErrors', 'stockEventReceipts', 'offlineAccess'],
        async () => {
          const queue = await db
            .table<QueuedStockEvent>('stockEventQueue')
            .orderBy('sequence')
            .toArray();
          const errors = await db.table<StockEventSyncError>('stockEventSyncErrors').toArray();
          const receipts = await db.table<StockEventReceipt>('stockEventReceipts').toArray();
          const access = await db.table<OfflineAccess>('offlineAccess').toCollection().first();
          return {
            permissionsFetchedAt: access?.fetchedAt,
            permissions: access ? parsePermissions(access.permissionStrings) : undefined,
            events: [
              ...queue.map((event) => ({
                ...event,
                error: errors.find(
                  (error) => error.localEventId === event.localEventId && !error.resolvedAt,
                ),
              })),
              ...errors
                .filter((error) => error.category !== 'uncertain' && !error.dismissedAt)
                .map((error) => ({ ...error.event, status: 'refused' as const, error })),
              ...receipts.flatMap((receipt) =>
                receipt.hiddenAt || !receipt.event
                  ? []
                  : [
                      {
                        ...receipt.event,
                        status: 'accepted' as const,
                        receipt,
                      },
                    ],
              ),
            ],
          };
        },
      );
      assertSessionScope(scope);
      return { ...events, hasDeviceEvents };
    }).subscribe({
      next: (result) => {
        if (scope === getSessionScope()) setState({ scope, attempt: retry, ...result });
      },
      error: (error: unknown) => {
        if (scope === getSessionScope()) setState({ scope, attempt: retry, error });
      },
    });
    return () => subscription.unsubscribe();
  }, [enabled, onlyIfPresent, scope, retry]);
  return {
    hasDeviceEvents: enabled && state.scope === scope && !!state.hasDeviceEvents,
    permissionsFetchedAt: state.scope === scope ? state.permissionsFetchedAt : undefined,
    permissions: state.scope === scope ? state.permissions : undefined,
    events: enabled && state.scope === scope && state.attempt === retry ? state.events : undefined,
    error: enabled && state.scope === scope && state.attempt === retry ? state.error : undefined,
    retry: () => setRetry((value) => value + 1),
  };
}
