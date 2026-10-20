import { onlineManager } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import { AxiosError, isAxiosError } from 'axios';
import { getLocalDb } from '@/integrations/local-db';
import { queryClient } from '@/integrations/tanstack-query';
import { prepareDeploymentTimeZone, storedTimeZone } from '@/lib/deployment-time-zone';
import {
  type DownloadProvider,
  type DownloadRecord,
  type DownloadTask,
  downloadProviders,
} from '@/lib/download-provider';
import { downloadSchedule } from '@/lib/download-schedule';
import {
  type AccessReaders,
  isDeviceAccess,
  type OfflineAccess,
  offlineAccessIsStale,
  refreshOfflineAccess,
} from '@/lib/offline-access';
import { offlineDownloadLock } from '@/lib/offline-download-lock';
import {
  type DownloadStatus,
  getDownloadStatus,
  setDownloadRefresh,
  setDownloadRetry,
  setDownloadStatus,
} from '@/lib/offline-download-status';
import { OFFLINE_FRESH_FOR } from '@/lib/offline-freshness';
import { isOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { getSessionState, subscribeSessionState } from '@/lib/session-state';
import { setUploadAccessReader, uploadAccessEpoch } from '@/lib/upload-access';

type Dependencies = {
  initialTrigger?: 'boot' | 'force';
  onTimeZoneFallback?: () => void;
  access:
    | AccessReaders
    | ((
        config: AxiosRequestConfig,
        check: () => void,
        purpose: 'download' | 'upload',
      ) => AccessReaders);
  providers: readonly DownloadProvider[];
};
type Trigger = 'boot' | 'force' | 'retry' | 'refresh' | 'access';
const triggerPriority: Record<Trigger, number> = {
  refresh: 0,
  boot: 1,
  access: 2,
  retry: 3,
  force: 4,
};
const FRESHNESS_CHECK_MS = 60_000;

export function startOfflineCoordinator(dependencies: Dependencies) {
  const providers = downloadProviders(dependencies.providers);
  const readersFor = (
    config: AxiosRequestConfig,
    check: () => void,
    purpose: 'download' | 'upload' = 'download',
  ) =>
    typeof dependencies.access === 'function'
      ? dependencies.access(config, check, purpose)
      : dependencies.access;
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
  const run = async (trigger: Trigger, periodic = false) => {
    const publishRun = (status: DownloadStatus) => publish({ ...status, trigger });
    const { referenceDataUserId: userId, isAuthenticated, expired } = getSessionState();
    if (stopped || !userId || !isAuthenticated || expired || !isOnline()) return;
    const db = getLocalDb();
    if (periodic) {
      const schedule = downloadSchedule(db.name);
      if (!schedule.due() || schedule.retryAt('access') > Date.now()) return;
    }
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
      if (!isOnline() || getSessionState().expired || stopped) throw new Error('Download stopped.');
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
      const [initialAccess, initialRecords] = await wait(
        Promise.all([
          accessTable.get(userId),
          Promise.all(
            providers.map(async (provider) => ({
              provider,
              records: await db
                .table<DownloadRecord>(provider.table)
                .toCollection()
                .primaryKeys()
                .then(async (keys) => {
                  const records = await db.table<DownloadRecord>(provider.table).bulkGet(keys);
                  return keys.flatMap((key, index) =>
                    records[index]
                      ? [[JSON.stringify(key), records[index].generation] as const]
                      : [],
                  );
                }),
            })),
          ),
        ]),
      );
      check();
      const baseline = new Map(
        initialRecords.flatMap(({ provider, records }) =>
          records.map(([key, generation]) => [`${provider.id}:${key}`, generation]),
        ),
      );
      channel?.postMessage({ type: 'observe' });
      await navigator.locks.request(name, { signal: controller.signal }, async () => {
        check();
        if (observedCompletion && !refreshPrograms.size) return;
        const schedule = downloadSchedule(db.name);
        if (periodic && (!schedule.due() || schedule.retryAt('access') > Date.now())) return;
        let saved = await accessTable.get(userId);
        check();
        const accessChanged = saved && saved.generation !== initialAccess?.generation;
        const refreshAccess =
          trigger === 'refresh'
            ? false
            : trigger === 'retry'
              ? previousStatus.accessFailed || !saved
              : trigger === 'boot'
                ? offlineAccessIsStale(saved)
                : !accessChanged;
        if (refreshAccess) {
          publishRun({ phase: 'running', incompletePrograms: [], accessFailed: true });
          const config = {
            session: false,
            backgroundRead: true,
            signal: controller.signal,
            sessionScope: scope,
          };
          const readers = readersFor(config, check);
          const epoch = uploadAccessEpoch();
          try {
            saved = await wait(refreshOfflineAccess(readers, check));
            check();
          } catch (error) {
            check();
            schedule.failed('access');
            schedule.save();
            throw error;
          }
          schedule.succeeded('access', saved.fetchedAt);
          if (epoch === uploadAccessEpoch()) freshAccess = { epoch, saved };
        }
        if (!saved) throw new Error('Access download unavailable');
        schedule.consider(saved.fetchedAt + OFFLINE_FRESH_FOR);
        const preparingTimeZone = refreshAccess || !storedTimeZone();
        const timeZone = preparingTimeZone
          ? wait(
              prepareDeploymentTimeZone(
                {
                  session: false,
                  backgroundRead: true,
                  signal: controller.signal,
                  sessionScope: scope,
                },
                dependencies.onTimeZoneFallback,
              ),
            ).then(() => undefined)
          : Promise.resolve();
        let timeZoneError: unknown;
        const preparedTimeZone = timeZone.catch((error: unknown) => {
          timeZoneError = error;
        });
        const failed: DownloadStatus['incompletePrograms'] = [];
        type Work = { provider: DownloadProvider; task: DownloadTask; workKey: string };
        const queue: Work[] = [];
        const eligibleKeys = new Set<string>();
        const requestedKeys = new Set(refreshPrograms);
        for (const key of requestedKeys) refreshPrograms.delete(key);
        for (const provider of providers) {
          if (!provider.eligible(saved)) continue;
          const table = db.table<DownloadRecord>(provider.table);
          for (const task of provider.tasks(saved)) {
            check();
            if (task.refreshKey) eligibleKeys.add(task.refreshKey);
            const workKey = `${provider.id}:${JSON.stringify(task.key)}`;
            if (periodic && schedule.retryAt(workKey) > Date.now()) {
              schedule.consider(schedule.retryAt(workKey));
              failed.push({
                id: task.id,
                name: task.name,
                dataset: provider.id,
                datasetLabel: provider.label,
              });
              continue;
            }
            const record = await table.get(task.key);
            check();
            const changed =
              record &&
              record.generation !== baseline.get(`${provider.id}:${JSON.stringify(task.key)}`);
            const requested = !!task.refreshKey && requestedKeys.has(task.refreshKey);
            if (trigger === 'refresh' && !requested) continue;
            if (
              !requested &&
              trigger === 'retry' &&
              !previousStatus.incompletePrograms.some(
                (item) => item.id === task.id && (!item.dataset || item.dataset === provider.id),
              ) &&
              !previousStatus.accessFailed
            )
              continue;
            if (
              changed ||
              (!requested && (trigger === 'boot' || trigger === 'access') && task.isFresh(record))
            ) {
              if (record) schedule.succeeded(workKey, record.fetchedAt);
              continue;
            }
            if (requested) {
              await db.transaction('rw', table, async () => {
                check();
                await table.update(task.key, { stale: true });
                check();
              });
              check();
            }
            queue.push({ provider, task, workKey: `${provider.id}:${JSON.stringify(task.key)}` });
          }
        }
        for (const key of refreshPrograms) if (!eligibleKeys.has(key)) refreshPrograms.delete(key);
        if (!refreshAccess && !queue.length) {
          await preparedTimeZone;
          if (timeZoneError) throw timeZoneError;
          check();
          schedule.save();
          if (!failed.length && (preparingTimeZone || previousStatus.phase === 'failed'))
            publishRun({ phase: 'complete', incompletePrograms: [] });
          return;
        }
        let reason: DownloadStatus['reason'];
        const incomplete = new Map(
          queue.map(({ provider, task, workKey }) => [
            workKey,
            { id: task.id, name: task.name, dataset: provider.id, datasetLabel: provider.label },
          ]),
        );
        publishRun({
          phase: 'running',
          incompletePrograms: [...incomplete.values()],
          accessFailed: false,
        });
        const worker = async () => {
          for (let work = queue.shift(); work; work = queue.shift()) {
            const { provider, task, workKey } = work;
            const table = db.table<DownloadRecord>(provider.table);
            check();
            try {
              const record = await wait(task.fetch(controller.signal));
              check();
              if (record.userId !== userId) throw new Error('Downloaded dataset owner mismatch');
              await db.transaction('rw', table, async () => {
                check();
                await table.put(record);
                check();
              });
              check();
              schedule.succeeded(workKey, record.fetchedAt);
              incomplete.delete(workKey);
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
                schedule.failed(workKey);
                schedule.save();
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
              schedule.failed(workKey);
              failed.push({
                id: task.id,
                name: task.name,
                dataset: provider.id,
                datasetLabel: provider.label,
              });
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(2, queue.length) }, worker));
        await preparedTimeZone;
        if (timeZoneError) throw timeZoneError;
        check();
        schedule.save();
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
      if (stopped || !isOnline() || getSessionState().expired || epoch !== uploadAccessEpoch())
        throw new Error('The sync access session changed.');
    };
    if (!navigator.locks) throw new Error('Web Locks are required for safe sync.');
    check();
    if (!force && freshAccess?.epoch === epoch) return freshAccess.saved;
    return navigator.locks.request(offlineDownloadLock(db), async () => {
      check();
      if (!force && freshAccess?.epoch === epoch) return freshAccess.saved;
      const config = { session: false, backgroundRead: true, sessionScope: scope };
      const readers = readersFor(config, check, 'upload');
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
  const unsubscribe = subscribeSessionState((state, previous) => {
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
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribeOnline = onlineManager.subscribe((online) => {
    clearTimeout(reconnectTimer);
    if (online) reconnectTimer = setTimeout(() => void run('force'), 250);
    else stopActive('offline');
  });
  const accessValues = new Map<string, string>();
  const observesAccess = ([resource, part, id]: readonly unknown[]) => {
    const userId = getSessionState().referenceDataUserId;
    return (
      !!userId &&
      ((resource === 'auth' && part === 'rights' && id === userId) ||
        (resource === 'users' && (part === 'record' || part === 'programs') && id === userId) ||
        (resource === 'facilities' && part === 'home'))
    );
  };
  const fingerprint = (value: unknown) =>
    JSON.stringify(value, (_key, item) => (item instanceof Set ? [...item].sort() : item));
  for (const query of queryClient.getQueryCache().getAll())
    if (observesAccess(query.queryKey) && !isDeviceAccess(query.state.data))
      accessValues.set(query.queryHash, fingerprint(query.state.data));
  const unsubscribeAccess = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    const { query } = event;
    if (!observesAccess(query.queryKey) || isDeviceAccess(query.state.data)) return;
    const value = fingerprint(query.state.data);
    const previous = accessValues.get(query.queryHash);
    accessValues.set(query.queryHash, value);
    if (previous === undefined || previous === value) return;
    freshAccess = undefined;
    void run('access');
  });
  const freshnessTimer = setInterval(() => {
    if (!active && document.visibilityState === 'visible') void run('boot', true);
  }, FRESHNESS_CHECK_MS);
  void run(dependencies.initialTrigger ?? 'boot');
  return () => {
    stopped = true;
    stopActive();
    unsubscribe();
    unsubscribeOnline();
    unsubscribeAccess();
    clearInterval(freshnessTimer);
    clearTimeout(reconnectTimer);
    channel?.close();
    setUploadAccessReader();
    setDownloadRetry();
    setDownloadRefresh();
  };
}
