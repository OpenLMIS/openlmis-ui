import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { wakeStockEventSync } from '@/features/stock-events/lib/device-event-status';
import { invalidateAcceptedStockEvent } from '@/features/stock-events/lib/refresh-after-stock-event-accepted';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type {
  StockEventReceipt,
  StockEventSyncError,
} from '@/features/stock-events/lib/stock-event-sync';
import { getLocalDb } from '@/integrations/local-db';
import { queryClient as defaultQueryClient } from '@/integrations/tanstack-query';
import { isOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope, useSessionScope } from '@/lib/session-scope';

export type StockEventDelivery =
  | { kind: 'accepted'; receipt: StockEventReceipt }
  | { kind: 'refused'; error: StockEventSyncError }
  | { kind: 'uncertain' }
  | { kind: 'blocked' }
  | { kind: 'held'; reason: NonNullable<QueuedStockEvent['pauseReason']> }
  | { kind: 'queued' };
export const foregroundStockEvents = new Set<string>();
const foregroundReleases = new Map<string, () => void>();
const foregroundLockPrefix = () => `${getLocalDb().name}:fg:`;
export const isForegroundStockEvent = (event: { localEventId: string }) =>
  foregroundStockEvents.has(event.localEventId);

export function releaseForegroundStockEvent(localEventId: string) {
  foregroundStockEvents.delete(localEventId);
  foregroundReleases.get(localEventId)?.();
  foregroundReleases.delete(localEventId);
}

export async function holdForegroundStockEvent(localEventId: string) {
  if (foregroundStockEvents.has(localEventId)) return;
  if (!navigator.locks) {
    foregroundStockEvents.add(localEventId);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    void navigator.locks
      .request(`${foregroundLockPrefix()}${localEventId}`, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          resolve();
          return;
        }
        foregroundStockEvents.add(localEventId);
        const held = new Promise<void>((release) => foregroundReleases.set(localEventId, release));
        resolve();
        await held;
      })
      .catch(reject);
  });
}

export async function foregroundStockEventIds(): Promise<ReadonlySet<string>> {
  const ids = new Set(foregroundStockEvents);
  if (navigator.locks?.query) {
    const prefix = foregroundLockPrefix();
    try {
      const { held } = await navigator.locks.query();
      for (const lock of held ?? [])
        if (lock.name?.startsWith(prefix)) ids.add(lock.name.slice(prefix.length));
    } catch {}
  }
  return ids;
}

export function useForegroundStockEventIds(enabled = true) {
  const scope = useSessionScope();
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const update = async () => {
      try {
        const current = await foregroundStockEventIds();
        if (active && scope === getSessionScope())
          setIds((previous) =>
            previous.size === current.size && [...current].every((id) => previous.has(id))
              ? previous
              : current,
          );
      } catch {}
    };
    void update();
    const timer = setInterval(() => void update(), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled, scope]);
  return ids;
}

export async function waitForStockEventReceipt(
  event: QueuedStockEvent,
  queryClient: QueryClient = defaultQueryClient,
): Promise<StockEventDelivery> {
  const db = getLocalDb();
  const scope = getSessionScope();
  if (!isOnline()) {
    releaseForegroundStockEvent(event.localEventId);
    return { kind: 'queued' };
  }
  await holdForegroundStockEvent(event.localEventId);
  return new Promise((resolve) => {
    let sending = false;
    let done = false;
    const finish = (outcome: StockEventDelivery) => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      clearTimeout(startDeadline);
      subscription.unsubscribe();
      unsubscribeOnline();
      releaseForegroundStockEvent(event.localEventId);
      if (outcome.kind === 'accepted' && scope === getSessionScope())
        invalidateAcceptedStockEvent(queryClient);
      resolve(outcome);
    };
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (!online && !sending) finish({ kind: 'queued' });
    });
    const startDeadline = setTimeout(() => {
      if (!sending) finish({ kind: 'queued' });
    }, 1500);
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
                (candidate.status === 'uncertain' || candidate.pauseReason === 'draft-changed'),
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
        else if (row.status === 'sending') sending = true;
      },
      error: () => finish({ kind: sending ? 'uncertain' : 'queued' }),
    });
    wakeStockEventSync();
  });
}
