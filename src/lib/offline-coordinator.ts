import { onlineManager } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
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
import { offlineDownloadLock } from '@/lib/offline-download-lock';
import {
  type DownloadStatus,
  getDownloadStatus,
  setDownloadRefresh,
  setDownloadRetry,
  setDownloadStatus,
} from '@/lib/offline-download-status';
import { isOnline } from '@/lib/online';
import { hasProgramGrant, parsePermissions, programGrants } from '@/lib/permissions';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { homeStockPrograms } from '@/lib/stock-programs';
import { setUploadAccessReader, uploadAccessEpoch } from '@/lib/upload-access';

type Dependencies = {
  initialTrigger?: 'boot' | 'force';
  access?: AccessReaders;
  bundle?: (filter: AdjustmentScope, signal: AbortSignal) => Promise<AdjustmentBundle>;
};
type Trigger = 'boot' | 'force' | 'retry' | 'refresh';
const triggerPriority: Record<Trigger, number> = { refresh: 0, boot: 1, retry: 2, force: 3 };

function accessReaders(config: AxiosRequestConfig): AccessReaders {
  return {
    permissions: (id) => fetchPermissionStrings(id, config),
    user: (id) => fetchUserRecord(id, config),
    programs: (id) => fetchUserPrograms(id, config),
    home: (id) => fetchFacility(id, config),
  };
}
function withRetry(raw: AccessReaders, check: () => void): AccessReaders {
  return {
    permissions: (id) => retryDownloadRead(() => raw.permissions(id), check),
    user: (id) => retryDownloadRead(() => raw.user(id), check),
    programs: (id) => retryDownloadRead(() => raw.programs(id), check),
    home: (id) => retryDownloadRead(() => raw.home(id), check),
  };
}

export function startOfflineCoordinator(dependencies: Dependencies = {}) {
  let freshAccess: { epoch: string; saved: OfflineAccess } | undefined;
  let active: AbortController | undefined;
  let channel: BroadcastChannel | undefined;
  let channelName: string | undefined;
  let stopped = false;
  let pending: Trigger | undefined;
  let observedCompletion = false;
  let observedRunning = false;
  const refreshPrograms = new Set<string>();
  const programKey = (facilityId: string, programId: string) => `${facilityId}:${programId}`;
  let watchedChannel: BroadcastChannel | undefined;
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
          : { phase: 'idle', incompletePrograms: [] },
      );
  };
  const run = async (trigger: Trigger) => {
    const publishRun = (status: DownloadStatus) => publish({ ...status, trigger });
    const { referenceDataUserId: userId, isAuthenticated, expired } = useLoginData.getState();
    if (stopped || !userId || !isAuthenticated || expired || !isOnline()) return;
    const db = getLocalDb();
    const name = offlineDownloadLock(db);
    if (channelName !== name) {
      channel?.close();
      channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(name);
      channelName = name;
      if (channel)
        channel.onmessage = ({ data }) => {
          if (data?.type === 'status') {
            setDownloadStatus(data.status);
            if (data.status.phase === 'running') {
              observedRunning = true;
              if (watchedChannel !== channel && navigator.locks) {
                watchedChannel = channel;
                const scope = getSessionScope();
                const observedChannel = channel;
                void navigator.locks
                  .request(name, { mode: 'shared' }, async () => {
                    // Completion messages may still be in flight after the lock is released.
                    await new Promise((resolve) => setTimeout(resolve, 25));
                    if (stopped || scope !== getSessionScope() || channel !== observedChannel)
                      return;
                    const status = getDownloadStatus();
                    if (status.phase === 'running')
                      setDownloadStatus(
                        status.incompletePrograms.length || status.accessFailed
                          ? { ...status, phase: 'failed', reason: 'read' }
                          : { phase: 'idle', incompletePrograms: [] },
                      );
                  })
                  .catch(() => undefined)
                  .finally(() => {
                    if (watchedChannel === observedChannel) watchedChannel = undefined;
                  });
              }
            }
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
      publishRun({ phase: 'unsupported', incompletePrograms: [] });
      return;
    }
    if (active) {
      if (!pending || triggerPriority[trigger] > triggerPriority[pending]) pending = trigger;
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
        if (observedCompletion && !refreshPrograms.size) return;
        let saved = await accessTable.get(userId);
        check();
        const accessChanged = saved && saved.generation !== initialAccess?.generation;
        const refreshAccess =
          trigger === 'refresh'
            ? false
            : trigger === 'retry'
              ? previousStatus.accessFailed || !saved
              : trigger === 'boot'
                ? downloadIsStale(saved)
                : !accessChanged;
        if (refreshAccess) {
          publishRun({ phase: 'running', incompletePrograms: [], accessFailed: true });
          const config = {
            session: false,
            backgroundRead: true,
            signal: controller.signal,
            sessionScope: scope,
          };
          const readers = withRetry(dependencies.access ?? accessReaders(config), check);
          const epoch = uploadAccessEpoch();
          saved = await wait(refreshOfflineAccess(readers, check));
          check();
          if (epoch === uploadAccessEpoch()) freshAccess = { epoch, saved };
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
        const failed: DownloadStatus['incompletePrograms'] = [];
        const queue: typeof eligible = [];
        const scanning = getFlag('GS1_SCANNING');
        for (const program of eligible) {
          check();
          const bundle = await bundles.get([home?.id ?? '', program.id]);
          check();
          const changed = bundle && bundle.generation !== baseline.get(program.id);
          const requestKey = programKey(home?.id ?? '', program.id);
          const requested = refreshPrograms.has(requestKey);
          if (trigger === 'refresh' && !requested) continue;
          if (
            !requested &&
            trigger === 'retry' &&
            !previousStatus.incompletePrograms.some((item) => item.id === program.id) &&
            !previousStatus.accessFailed
          )
            continue;
          if (
            !requested &&
            (changed ||
              (trigger === 'boot' &&
                !downloadIsStale(bundle) &&
                bundle?.facilityTypeId === home?.type.id &&
                (!scanning || bundle?.scanning)))
          )
            continue;
          if (requested) {
            refreshPrograms.delete(requestKey);
            await db.transaction('rw', bundles, async () => {
              check();
              await bundles.update([home?.id ?? '', program.id], { stale: true });
              check();
            });
            check();
          }
          queue.push(program);
        }
        const eligibleKeys = new Set(
          eligible.map((program) => programKey(home?.id ?? '', program.id)),
        );
        for (const requestKey of refreshPrograms)
          if (!eligibleKeys.has(requestKey)) refreshPrograms.delete(requestKey);
        if (!refreshAccess && !queue.length) return;
        let reason: DownloadStatus['reason'];
        const incomplete = new Map(
          [
            ...failed,
            ...queue.map((program) => ({ id: program.id, name: program.name ?? program.code })),
          ].map((program) => [program.id, program]),
        );
        publishRun({
          phase: 'running',
          incompletePrograms: [...incomplete.values()],
          accessFailed: false,
        });
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
              publishRun({
                phase: 'running',
                incompletePrograms: [...incomplete.values()],
                accessFailed: false,
              });
            } catch (error) {
              check();
              if (
                isAxiosError(error) &&
                !error.response &&
                error.code !== AxiosError.ECONNABORTED &&
                error.code !== AxiosError.ERR_CANCELED
              ) {
                publishRun({
                  phase: 'failed',
                  incompletePrograms: [...incomplete.values()],
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
        publishRun(
          failed.length
            ? {
                phase: 'failed',
                incompletePrograms: failed,
                reason: reason ?? 'read',
                accessFailed: false,
              }
            : { phase: 'complete', incompletePrograms: [] },
        );
      });
    } catch (error) {
      if (scope === getSessionScope() && !stopped && !controller.signal.aborted) {
        publishRun({
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
  setUploadAccessReader(async (force) => {
    const epoch = uploadAccessEpoch();
    const scope = getSessionScope();
    const db = getLocalDb();
    const check = () => {
      assertSessionScope(scope);
      if (
        stopped ||
        !isOnline() ||
        useLoginData.getState().expired ||
        epoch !== uploadAccessEpoch()
      )
        throw new Error('The sync access session changed.');
    };
    if (!navigator.locks) throw new Error('Web Locks are required for safe sync.');
    check();
    if (!force && freshAccess?.epoch === epoch) return freshAccess.saved;
    return navigator.locks.request(offlineDownloadLock(db), async () => {
      check();
      if (!force && freshAccess?.epoch === epoch) return freshAccess.saved;
      const config = { session: false, backgroundRead: true, sessionScope: scope };
      const readers = dependencies.access ?? accessReaders(config);
      const saved = await refreshOfflineAccess(readers, check);
      check();
      freshAccess = { epoch, saved };
      return saved;
    });
  });
  setDownloadStatus({ phase: 'idle', incompletePrograms: [] });
  setDownloadRetry(() => {
    void run('retry');
  });
  setDownloadRefresh(({ facilityId, programId }) => {
    refreshPrograms.add(programKey(facilityId, programId));
    void run('refresh');
  });
  const unsubscribe = useLoginData.subscribe((state, previous) => {
    if (state.referenceDataUserId !== previous.referenceDataUserId) {
      stopActive();
      channel?.close();
      channel = undefined;
      channelName = undefined;
      refreshPrograms.clear();
      setDownloadStatus({ phase: 'idle', incompletePrograms: [] });
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
  void run(dependencies.initialTrigger ?? 'boot');
  return () => {
    stopped = true;
    stopActive();
    unsubscribe();
    unsubscribeOnline();
    channel?.close();
    setUploadAccessReader();
    setDownloadRetry();
    setDownloadRefresh();
  };
}
