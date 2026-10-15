import { onlineManager } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { liveQuery } from 'dexie';
import { toast } from 'sonner';
import { useLoginData } from '@/features/auth/store/login-data';
import { foregroundStockEvents } from '@/features/stock-events/lib/stock-event-delivery';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import {
  pruneStockEvents,
  recoverSending,
  type SyncDependencies,
  syncStockEvents,
} from '@/features/stock-events/lib/stock-event-sync';
import { client } from '@/integrations/axios';
import i18n from '@/integrations/i18n';
import { getLocalDb } from '@/integrations/local-db';
import { queryClient } from '@/integrations/tanstack-query';
import { setSyncPhase, setSyncWake } from '@/lib/device-event-status';
import { announceDeviceSave } from '@/lib/device-save-announcement';
import { queryKeys } from '@/lib/key-factory';
import { refreshOfflineProgram } from '@/lib/offline-download-status';
import { isOnline, reportConnectionFailure } from '@/lib/online';
import { hasProgramGrant, parsePermissions } from '@/lib/permissions';
import { QueueReceiptError } from '@/lib/queue-transport';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { freshUploadAccess, uploadAccessEpoch } from '@/lib/upload-access';

export function startStockEventUploader(
  dependencies: {
    access?: typeof freshUploadAccess;
    send?: SyncDependencies['send'];
    retryReceipt?: () => Promise<void>;
  } = {},
) {
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
    const state = useLoginData.getState();
    return (
      !stopped &&
      isOnline() &&
      state.isAuthenticated &&
      !state.expired &&
      !!state.accessToken &&
      pausedEpoch !== uploadAccessEpoch()
    );
  };
  const run = async () => {
    if (running) {
      pending = true;
      return;
    }
    const userId = useLoginData.getState().referenceDataUserId;
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
          setSyncPhase(
            useLoginData.getState().expired || pausedEpoch === uploadAccessEpoch()
              ? 'session'
              : 'idle',
          );
          return;
        }
        const count = await db.table('stockEventQueue').where('status').equals('queued').count();
        check();
        if (!count) {
          setSyncPhase('idle');
          return;
        }
        const epoch = uploadAccessEpoch();
        const force = forceAccess;
        forceAccess = false;
        const access = await (dependencies.access ?? freshUploadAccess)(force);
        check();
        if (!valid() || epoch !== uploadAccessEpoch() || access.userId !== userId) return;
        const permissions = parsePermissions(access.permissionStrings ?? []);
        setSyncPhase('syncing');
        const send: SyncDependencies['send'] =
          dependencies.send ??
          (async (event) => {
            try {
              const response = await client.post('/stockEvents', event.postBody, {
                queueTransport: { userId },
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
        await syncStockEvents(db, userId, {
          check,
          canSend: () => valid() && epoch === uploadAccessEpoch(),
          permitted: (event) =>
            access.homeFacility?.id === event.facilityId &&
            access.programs.some((program) => program.id === event.programId) &&
            hasProgramGrant(permissions, 'STOCK_ADJUST', event.facilityId, event.programId),
          send: async (event) => {
            const response = await send(event);
            if (response.status === 401) pausedEpoch = epoch;
            return response;
          },
          retryReceipt:
            dependencies.retryReceipt ??
            (async () => {
              setSyncPhase('receipt');
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }),
          accepted: (event: QueuedStockEvent) => {
            check();
            refreshOfflineProgram(event);
            announceDeviceSave('device-events.synced');
            for (const queryKey of [
              queryKeys.stockEvents.all,
              queryKeys.stockCards.all,
              queryKeys.stockCardSummaries.all,
            ])
              void queryClient.invalidateQueries({ queryKey });
            if (!foregroundStockEvents.has(event.localEventId))
              toast.success(i18n.t('device-events.synced'), {
                description: i18n.t('device-events.synced-description'),
              });
          },
        });
        check();
        retryDelay = 1000;
        setSyncPhase(
          useLoginData.getState().expired || pausedEpoch === uploadAccessEpoch()
            ? 'session'
            : 'idle',
        );
      });
    } catch (error) {
      if (scope === getSessionScope() && !stopped) {
        reportConnectionFailure(error);
        setSyncPhase(useLoginData.getState().expired ? 'session' : 'failed');
        if (!useLoginData.getState().expired && !retryTimer) {
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
    if (!useLoginData.getState().referenceDataUserId) return;
    const scope = getSessionScope();
    const db = getLocalDb();
    subscription = liveQuery(() =>
      db.table<QueuedStockEvent>('stockEventQueue').toArray(),
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
  const unsubscribe = useLoginData.subscribe((state, previous) => {
    if (state.referenceDataUserId !== previous.referenceDataUserId) {
      pausedEpoch = undefined;
      setSyncPhase('idle');
      watch();
    }
    if (state.expired) setSyncPhase('session');
    if (
      state.isAuthenticated &&
      !state.expired &&
      (previous.expired ||
        state.accessToken !== previous.accessToken ||
        state.referenceDataUserId !== previous.referenceDataUserId)
    )
      void run();
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
    forceAccess = true;
    void run();
  });
  watch();
  void run();
  return () => {
    stopped = true;
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
