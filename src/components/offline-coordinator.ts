import { onlineManager } from '@tanstack/react-query';
import { AxiosError, isAxiosError } from 'axios';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchFacility,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import { getLocalDb } from '@/integrations/local-db';
import {
  type AdjustmentBundle,
  type AdjustmentScope,
  downloadIsStale,
  fetchAdjustmentBundle,
  retryDownloadRead,
} from '@/lib/adjustment-bundle';
import { getFlag } from '@/lib/feature-flags';
import { type AccessReaders, type OfflineAccess, refreshOfflineAccess } from '@/lib/offline-access';
import {
  type DownloadStatus,
  getDownloadStatus,
  setDownloadRetry,
  setDownloadStatus,
} from '@/lib/offline-download-status';
import { isOnline } from '@/lib/online';
import { hasProgramGrant, parsePermissions, programGrants } from '@/lib/permissions';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { homeStockPrograms } from '@/lib/stock-programs';

type Dependencies = {
  access?: AccessReaders;
  bundle?: (filter: AdjustmentScope, signal: AbortSignal) => Promise<AdjustmentBundle>;
};
type Trigger = 'boot' | 'force' | 'retry';

export function startOfflineCoordinator(dependencies: Dependencies = {}) {
  let active: AbortController | undefined;
  let channel: BroadcastChannel | undefined;
  let channelName: string | undefined;
  let stopped = false;
  let pending: Trigger | undefined;
  let observedCompletion = false;
  let observedRunning = false;
  const publish = (status: DownloadStatus) => {
    setDownloadStatus(status);
    channel?.postMessage({ type: 'status', status });
  };
  const stopActive = (reason?: DownloadStatus['reason']) => {
    active?.abort();
    if (getDownloadStatus().phase === 'running')
      publish(
        reason
          ? { ...getDownloadStatus(), phase: 'failed', reason }
          : { phase: 'idle', failed: [] },
      );
  };
  const run = async (trigger: Trigger) => {
    const { referenceDataUserId: userId, isAuthenticated, expired } = useLoginData.getState();
    if (stopped || !userId || !isAuthenticated || expired || !isOnline()) return;
    const db = getLocalDb();
    const name = `${db.name}:offline-download`;
    if (channelName !== name) {
      channel?.close();
      channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(name);
      channelName = name;
      if (channel)
        channel.onmessage = ({ data }) => {
          if (data?.type === 'status') {
            setDownloadStatus(data.status);
            if (data.status.phase === 'running') observedRunning = true;
            if (
              observedRunning &&
              (data.status.phase === 'complete' || data.status.phase === 'failed')
            )
              observedCompletion = true;
          }
          if (data?.type === 'observe' && active && getDownloadStatus().phase === 'running')
            channel?.postMessage({ type: 'status', status: getDownloadStatus() });
        };
    }
    if (!navigator.locks) {
      publish({ phase: 'unsupported', failed: [] });
      return;
    }
    if (active) {
      pending = trigger;
      return;
    }
    const controller = new AbortController();
    active = controller;
    const scope = getSessionScope();
    const check = () => {
      assertSessionScope(scope);
      controller.signal.throwIfAborted();
      if (!isOnline() || useLoginData.getState().expired || stopped)
        throw new Error('Download stopped.');
    };
    const wait = <T>(promise: Promise<T>): Promise<T> =>
      new Promise((resolve, reject) => {
        const abort = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', abort, { once: true });
        promise
          .then(resolve, reject)
          .finally(() => controller.signal.removeEventListener('abort', abort));
        if (controller.signal.aborted) abort();
      });
    const previousStatus = getDownloadStatus();
    observedCompletion = false;
    observedRunning = false;
    try {
      const accessTable = db.table<OfflineAccess>('offlineAccess');
      const bundles = db.table<AdjustmentBundle>('adjustmentDownloads');
      const [initialAccess, initialBundles] = await wait(
        Promise.all([accessTable.get(userId), bundles.toArray()]),
      );
      check();
      const baseline = new Map(
        initialBundles.map((bundle) => [bundle.programId, bundle.generation]),
      );
      channel?.postMessage({ type: 'observe' });
      await navigator.locks.request(name, { signal: controller.signal }, async () => {
        check();
        if (observedCompletion) return;
        let saved = await accessTable.get(userId);
        check();
        const accessChanged = saved && saved.generation !== initialAccess?.generation;
        const refreshAccess =
          trigger === 'retry'
            ? previousStatus.accessFailed || !saved
            : trigger === 'boot'
              ? downloadIsStale(saved)
              : !accessChanged;
        publish({ phase: 'running', failed: [], accessFailed: Boolean(refreshAccess) });
        if (refreshAccess) {
          const config = {
            session: false,
            backgroundRead: true,
            signal: controller.signal,
            sessionScope: scope,
          };
          const raw = dependencies.access ?? {
            permissions: (id: string) => fetchPermissionStrings(id, config),
            user: (id: string) => fetchUserRecord(id, config),
            programs: (id: string) => fetchUserPrograms(id, config),
            home: (id: string) => fetchFacility(id, config),
          };
          const readers: AccessReaders = {
            permissions: (id) => retryDownloadRead(() => raw.permissions(id), check),
            user: (id) => retryDownloadRead(() => raw.user(id), check),
            programs: (id) => retryDownloadRead(() => raw.programs(id), check),
            home: (id) => retryDownloadRead(() => raw.home(id), check),
          };
          saved = await wait(refreshOfflineAccess(readers, check));
          check();
        }
        if (!saved) throw new Error('Access download unavailable');
        const home = saved.homeFacility;
        const permissions = parsePermissions(saved.permissionStrings);
        const programs = homeStockPrograms({
          homeFacility: home,
          programs: saved.programs,
          grants: programGrants(permissions, 'STOCK_ADJUST'),
        });
        const eligible = programs.filter(
          (program) =>
            home && hasProgramGrant(permissions, 'STOCK_CARDS_VIEW', home.id, program.id),
        );
        const failed: DownloadStatus['failed'] = programs
          .filter((program) => !eligible.includes(program))
          .map((program) => ({ id: program.id, name: program.name ?? program.code }));
        const queue: typeof eligible = [];
        const scanning = getFlag('GS1_SCANNING');
        for (const program of eligible) {
          check();
          const bundle = await bundles.get([home?.id ?? '', program.id]);
          check();
          const changed = bundle && bundle.generation !== baseline.get(program.id);
          if (
            trigger === 'retry' &&
            !previousStatus.failed.some((item) => item.id === program.id) &&
            !previousStatus.accessFailed
          )
            continue;
          if (
            changed ||
            (trigger === 'boot' &&
              !downloadIsStale(bundle) &&
              bundle?.facilityTypeId === home?.type.id &&
              (!scanning || bundle?.scanning))
          )
            continue;
          queue.push(program);
        }
        let reason: DownloadStatus['reason'];
        const incomplete = new Map(
          [
            ...failed,
            ...queue.map((program) => ({ id: program.id, name: program.name ?? program.code })),
          ].map((program) => [program.id, program]),
        );
        publish({ phase: 'running', failed: [...incomplete.values()], accessFailed: false });
        const worker = async () => {
          for (let program = queue.shift(); program; program = queue.shift()) {
            check();
            try {
              const filter: AdjustmentScope = {
                facilityId: home?.id ?? '',
                programId: program.id,
                facilityTypeId: home?.type.id ?? '',
                scanning,
              };
              const bundle = await wait(
                (dependencies.bundle ?? fetchAdjustmentBundle)(filter, controller.signal),
              );
              check();
              if (
                bundle.userId !== userId ||
                bundle.facilityId !== filter.facilityId ||
                bundle.programId !== filter.programId ||
                bundle.facilityTypeId !== filter.facilityTypeId ||
                bundle.formatVersion !== 1
              )
                throw new Error('Downloaded bundle scope mismatch');
              await db.transaction('rw', bundles, async () => {
                check();
                await bundles.put(bundle);
                check();
              });
              check();
              incomplete.delete(program.id);
              publish({ phase: 'running', failed: [...incomplete.values()], accessFailed: false });
            } catch (error) {
              check();
              if (
                isAxiosError(error) &&
                !error.response &&
                error.code !== AxiosError.ECONNABORTED &&
                error.code !== AxiosError.ERR_CANCELED
              ) {
                publish({
                  phase: 'failed',
                  failed: [...incomplete.values()],
                  reason: 'offline',
                  accessFailed: false,
                });
                controller.abort();
                throw error;
              }
              if (isAxiosError(error) && error.code === AxiosError.ECONNABORTED) reason = 'timeout';
              else reason ??= 'read';
              failed.push({ id: program.id, name: program.name ?? program.code });
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(2, queue.length) }, worker));
        check();
        publish(
          failed.length
            ? { phase: 'failed', failed, reason: reason ?? 'read', accessFailed: false }
            : { phase: 'complete', failed: [] },
        );
      });
    } catch (error) {
      if (scope === getSessionScope() && !stopped && !controller.signal.aborted) {
        publish({
          ...getDownloadStatus(),
          phase: 'failed',
          reason:
            isAxiosError(error) && error.code === AxiosError.ECONNABORTED ? 'timeout' : 'read',
        });
      }
    } finally {
      if (active === controller) active = undefined;
      const next = pending;
      pending = undefined;
      if (next && !stopped) void run(next);
    }
  };
  setDownloadStatus({ phase: 'idle', failed: [] });
  setDownloadRetry(() => {
    void run('retry');
  });
  const unsubscribe = useLoginData.subscribe((state, previous) => {
    if (state.referenceDataUserId !== previous.referenceDataUserId) {
      stopActive();
      channel?.close();
      channel = undefined;
      channelName = undefined;
      setDownloadStatus({ phase: 'idle', failed: [] });
    }
    if (state.expired) stopActive('session');
    if (!state.isAuthenticated || state.expired) return;
    if (
      state.referenceDataUserId !== previous.referenceDataUserId ||
      state.accessToken !== previous.accessToken ||
      previous.expired
    )
      void run('force');
  });
  const unsubscribeOnline = onlineManager.subscribe((online) => {
    if (online) void run('force');
    else stopActive('offline');
  });
  void run('boot');
  return () => {
    stopped = true;
    stopActive();
    unsubscribe();
    unsubscribeOnline();
    channel?.close();
    setDownloadRetry();
  };
}
