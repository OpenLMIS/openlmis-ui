import { onlineManager } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { liveQuery } from 'dexie';
import { toast } from 'sonner';
import {
  beginSyncPreparation,
  getSyncPhase,
  setSyncPhase,
  setSyncWake,
} from '@/features/stock-events/lib/device-event-status';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import {
  QueueReceiptError,
  stockEventTransport,
} from '@/features/stock-events/lib/queue-transport';
import {
  refreshAfterStockEventAccepted,
  subscribeStockEventAcceptances,
} from '@/features/stock-events/lib/refresh-after-stock-event-accepted';
import { foregroundStockEventIds } from '@/features/stock-events/lib/stock-event-delivery';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import {
  pruneStockEvents,
  recoverSending,
  type StockEventSyncError,
  type SyncDependencies,
  syncStockEvents,
} from '@/features/stock-events/lib/stock-event-sync';
import { client } from '@/integrations/axios';
import i18n from '@/integrations/i18n';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { queryClient } from '@/integrations/tanstack-query';
import type { OfflineAccess } from '@/lib/offline-access';
import { isOnline, reportConnectionFailure } from '@/lib/online';
import { hasProgramGrant, parsePermissions } from '@/lib/permissions';
import { onSessionResumed } from '@/lib/session-resumed';
import {
  assertSessionScope,
  getSessionAccessToken,
  getSessionScope,
  getSessionUserId,
  isSessionAuthenticated,
  isSessionExpired,
} from '@/lib/session-scope';
import { uploadAccessEpoch } from '@/lib/upload-access';

export function startStockEventUploader(dependencies: {
  access: (force?: boolean) => Promise<OfflineAccess>;
  refresh?: (refreshKey: string) => void;
  send?: SyncDependencies['send'];
  retryReceipt?: () => Promise<void>;
}) {
  const stopAcceptances = subscribeStockEventAcceptances(queryClient);
  let stopped = false;
  let running = false;
  let pending = false;
  let subscription: ReturnType<ReturnType<typeof liveQuery>['subscribe']> | undefined;
  let pausedEpoch: string | undefined;
  let forceAccess = false;
  let accessPaused = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let accessTimer: ReturnType<typeof setInterval> | undefined;
  let retryDelay = 1000;
  const pruned = new Set<string>();
  const valid = () => {
    return (
      !stopped &&
      isOnline() &&
      isSessionAuthenticated() &&
      !isSessionExpired() &&
      !!getSessionAccessToken() &&
      pausedEpoch !== uploadAccessEpoch()
    );
  };
  const restingPhase = () =>
    isSessionExpired() || pausedEpoch === uploadAccessEpoch() ? 'session' : 'idle';
  const run = async () => {
    if (running) {
      pending = true;
      return;
    }
    const userId = getSessionUserId();
    if (stopped || !userId) return;
    if (!navigator.locks) {
      setSyncPhase('unsupported');
      return;
    }
    running = true;
    const db = getLocalDb();
    const scope = getSessionScope();
    const check = () => {
      assertSessionScope(scope);
      if (stopped) throw new Error('Uploader stopped.');
    };
    try {
      await navigator.locks.request(`${db.name}:offline-upload`, async () => {
        check();
        await recoverSending(db, userId, check);
        check();
        if (!pruned.has(db.name)) {
          pruned.add(db.name);
          await pruneStockEvents(db, check);
          check();
        }
        if (!valid()) {
          setSyncPhase(restingPhase());
          return;
        }
        const count = await db
          .table(LOCAL_TABLES.stockEventQueue)
          .where('status')
          .equals('queued')
          .count();
        check();
        if (!count) {
          if (getSyncPhase() !== 'complete') setSyncPhase('idle');
          return;
        }
        const epoch = uploadAccessEpoch();
        const force = forceAccess;
        forceAccess = false;
        const endPreparation = beginSyncPreparation();
        const access = await dependencies.access(force).finally(endPreparation);
        check();
        if (!valid() || epoch !== uploadAccessEpoch() || access.userId !== userId) return;
        const permissions = parsePermissions(access.permissionStrings ?? []);
        const send: SyncDependencies['send'] =
          dependencies.send ??
          (async (event) => {
            try {
              const response = await client.post('/stockEvents', event.postBody, {
                queueTransport: stockEventTransport(userId),
                sessionScope: scope,
                sentFor: userId,
              });
              return { status: response.status, data: response.data };
            } catch (error) {
              if (error instanceof QueueReceiptError) return error.response;
              if (isAxiosError(error) && error.response)
                return { status: error.response.status, data: error.response.data };
              throw error;
            }
          });
        let acceptedCount = 0;
        let sentCount = 0;
        const backgroundEvents = new Set<string>();
        let foreground = false;
        await syncStockEvents(db, userId, {
          check,
          canSend: () => valid() && epoch === uploadAccessEpoch(),
          permitted: (event) =>
            access.homeFacility?.id === event.facilityId &&
            access.programs.some((program) => program.id === event.programId) &&
            hasProgramGrant(
              permissions,
              EVENT_KINDS[event.kind].right,
              event.facilityId,
              event.programId,
            ),
          send: async (event) => {
            foreground = (await foregroundStockEventIds()).has(event.localEventId);
            if (!foreground) {
              backgroundEvents.add(event.localEventId);
              sentCount++;
              setSyncPhase('syncing');
            }
            const response = await send(event);
            if (response.status === 401) pausedEpoch = epoch;
            return response;
          },
          retryReceipt:
            dependencies.retryReceipt ??
            (async () => {
              if (!foreground) setSyncPhase('receipt');
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }),
          accepted: (event: QueuedStockEvent) => {
            check();
            refreshAfterStockEventAccepted(queryClient, event, dependencies.refresh);
            if (backgroundEvents.has(event.localEventId)) acceptedCount++;
          },
        });
        check();
        if (acceptedCount)
          toast.success(i18n.t('offline-events.synced'), {
            description: i18n.t('offline-events.synced-count', { count: acceptedCount }),
          });
        const { unfinished, refusedCount } = await db.transaction(
          'r',
          [LOCAL_TABLES.stockEventQueue, LOCAL_TABLES.stockEventSyncErrors],
          async () => {
            const queued = await db
              .table<QueuedStockEvent>(LOCAL_TABLES.stockEventQueue)
              .filter((event) => event.userId === userId)
              .count();
            const errors = await db
              .table<StockEventSyncError>(LOCAL_TABLES.stockEventSyncErrors)
              .filter(
                (error) => error.event.userId === userId && !error.resolvedAt && !error.dismissedAt,
              )
              .count();
            const refusedCount = await db
              .table<StockEventSyncError>(LOCAL_TABLES.stockEventSyncErrors)
              .filter(
                (error) =>
                  error.event.userId === userId &&
                  backgroundEvents.has(error.localEventId) &&
                  error.category !== 'uncertain' &&
                  !error.resolvedAt &&
                  !error.dismissedAt,
              )
              .count();
            return { unfinished: queued + errors, refusedCount };
          },
        );
        check();
        if (refusedCount)
          toast.error(i18n.t('offline-events.refused-summary', { count: refusedCount }), {
            description: i18n.t('offline-events.refused-summary-description'),
          });
        setSyncPhase(
          acceptedCount &&
            acceptedCount === sentCount &&
            !unfinished &&
            valid() &&
            epoch === uploadAccessEpoch()
            ? 'complete'
            : restingPhase(),
        );
      });
      retryDelay = 1000;
      clearTimeout(retryTimer);
      retryTimer = undefined;
    } catch (error) {
      if (scope === getSessionScope() && !stopped) {
        reportConnectionFailure(error);
        setSyncPhase(isSessionExpired() ? 'session' : 'failed');
        if (!isSessionExpired() && !retryTimer) {
          retryTimer = setTimeout(() => {
            retryTimer = undefined;
            void run();
          }, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000);
        }
      }
    } finally {
      running = false;
      if (pending && !stopped) {
        pending = false;
        void run();
      }
    }
  };
  const watch = () => {
    subscription?.unsubscribe();
    subscription = undefined;
    clearInterval(accessTimer);
    accessTimer = undefined;
    accessPaused = false;
    if (!getSessionUserId()) return;
    const scope = getSessionScope();
    const db = getLocalDb();
    subscription = liveQuery(() =>
      db.table<QueuedStockEvent>(LOCAL_TABLES.stockEventQueue).toArray(),
    ).subscribe({
      next: (rows) => {
        if (scope !== getSessionScope()) return;
        accessPaused = rows.some((row) => row.pauseReason === 'access-changed');
        if (!accessPaused) {
          clearInterval(accessTimer);
          accessTimer = undefined;
        } else if (!accessTimer) {
          accessTimer = setInterval(() => {
            forceAccess = true;
            void run();
          }, 30000);
        }
        void run();
      },
      error: () => {
        if (scope === getSessionScope()) setSyncPhase('failed');
      },
    });
  };
  const unsubscribe = onSessionResumed({
    onUserChange: () => {
      pausedEpoch = undefined;
      forceAccess = false;
      retryDelay = 1000;
      clearTimeout(retryTimer);
      retryTimer = undefined;
      setSyncPhase('idle');
      watch();
    },
    onExpired: () => setSyncPhase('session'),
    onResume: () => {
      void run();
    },
  });
  const unsubscribeOnline = onlineManager.subscribe((online) => {
    if (online) void run();
  });
  const focus = () => {
    if (!accessPaused) return;
    forceAccess = true;
    void run();
  };
  window.addEventListener('focus', focus);
  setSyncWake(() => {
    forceAccess ||= accessPaused;
    void run();
  });
  watch();
  void run();
  return () => {
    stopped = true;
    stopAcceptances();
    clearTimeout(retryTimer);
    clearInterval(accessTimer);
    window.removeEventListener('focus', focus);
    subscription?.unsubscribe();
    unsubscribe();
    unsubscribeOnline();
    setSyncWake();
    setSyncPhase('idle');
  };
}
