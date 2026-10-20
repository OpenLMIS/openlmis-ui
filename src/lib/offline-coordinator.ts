import { onlineManager } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import { AxiosError, isAxiosError } from 'axios';
import { useLoginData } from '@/features/auth/store/login-data';
import { getLocalDb } from '@/integrations/local-db';
import { queryClient } from '@/integrations/tanstack-query';
import { prepareDeploymentTimeZone, storedTimeZone } from '@/lib/deployment-time-zone';
import type { DownloadProvider, DownloadRecord, DownloadTask } from '@/lib/download-provider';
import { downloadSchedule } from '@/lib/download-schedule';
import {
  type AccessReaders,
  isDeviceAccess,
  type OfflineAccess,
  offlineAccessIsStale,
  refreshOfflineAccess,
} from '@/lib/offline-access';
import { createDownloadChannel } from '@/lib/offline-download-channel';
import { downloadDecision } from '@/lib/offline-download-decision';
import { offlineDownloadLock } from '@/lib/offline-download-lock';
import {
  type DownloadStatus,
  getDownloadStatus,
  setDownloadRetry,
  setDownloadStatus,
} from '@/lib/offline-download-status';
import { OFFLINE_FRESH_FOR } from '@/lib/offline-freshness';
import { isOnline } from '@/lib/online';
import { onSessionResumed } from '@/lib/session-resumed';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { uploadAccessEpoch } from '@/lib/upload-access';

type Dependencies = {
  initialTrigger?: 'boot' | 'force';
  onTimeZoneFallback?: () => void;
  access: (
    config: AxiosRequestConfig,
    check: () => void,
    purpose: 'download' | 'upload',
  ) => AccessReaders;
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

const downloadEntry = (provider: DownloadProvider, task: DownloadTask) => ({
  id: task.id,
  name: task.name,
  dataset: provider.id,
  datasetLabel: provider.label,
});

export function startOfflineCoordinator(dependencies: Dependencies) {
  const providers = dependencies.providers;
  let freshAccess: { epoch: string; saved: OfflineAccess } | undefined;
  let active: AbortController | undefined;
  let stopped = false;
  let pending: Trigger | undefined;
  const refreshKeys = new Set<string>();
  const channel = createDownloadChannel(() => !!active);
  const publish = channel.publish;
  const stopActive = (reason?: DownloadStatus['reason']) => {
    active?.abort();
    if (getDownloadStatus().phase === 'running')
      publish(
        reason
          ? { ...getDownloadStatus(), phase: 'failed', reason }
          : { phase: 'idle', incomplete: [] },
      );
  };
  const run = async (trigger: Trigger, periodic = false) => {
    const publishRun = (status: DownloadStatus) => publish({ ...status, trigger });
    const { referenceDataUserId: userId, isAuthenticated, expired } = useLoginData.getState();
    if (stopped || !userId || !isAuthenticated || expired || !isOnline()) return;
    const db = getLocalDb();
    if (periodic) {
      const schedule = downloadSchedule(db.name);
      if (!schedule.due() || schedule.retryAt('access') > Date.now()) return;
    }
    const name = offlineDownloadLock(db);
    channel.connect(name);
    if (!navigator.locks) {
      publishRun({ phase: 'unsupported', incomplete: [] });
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
    const config = {
      session: false,
      backgroundRead: true,
      signal: controller.signal,
      sessionScope: scope,
    };
    const previousStatus = getDownloadStatus();
    channel.resetObservations();
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
      channel.observe();
      await navigator.locks.request(name, { signal: controller.signal }, async () => {
        check();
        if (channel.completed() && !refreshKeys.size) return;
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
          publishRun({ phase: 'running', incomplete: [], accessFailed: true });
          const readers = dependencies.access(config, check, 'download');
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
          ? wait(prepareDeploymentTimeZone(config, dependencies.onTimeZoneFallback)).then(
              () => undefined,
            )
          : Promise.resolve();
        let timeZoneError: unknown;
        const preparedTimeZone = timeZone.catch((error: unknown) => {
          timeZoneError = error;
        });
        const failed: DownloadStatus['incomplete'] = [];
        type Work = { provider: DownloadProvider; task: DownloadTask; workKey: string };
        const queue: Work[] = [];
        const eligibleKeys = new Set<string>();
        const requestedKeys = new Set(refreshKeys);
        for (const key of requestedKeys) refreshKeys.delete(key);
        for (const provider of providers) {
          const table = db.table<DownloadRecord>(provider.table);
          for (const task of provider.tasks(saved)) {
            check();
            if (task.refreshKey) eligibleKeys.add(task.refreshKey);
            const workKey = `${provider.id}:${JSON.stringify(task.key)}`;
            const retryAt = periodic ? schedule.retryAt(workKey) : 0;
            const record = await table.get(task.key);
            check();
            const requested = !!task.refreshKey && requestedKeys.has(task.refreshKey);
            const decision = downloadDecision({
              trigger,
              requested,
              retryAt,
              now: Date.now(),
              failed: previousStatus.incomplete.some(
                (item) => item.id === task.id && item.dataset === provider.id,
              ),
              accessFailed: !!previousStatus.accessFailed,
              changed: !!record && record.generation !== baseline.get(workKey),
              fresh: task.isFresh(record),
            });
            if (decision === 'defer') {
              schedule.consider(retryAt);
              failed.push(downloadEntry(provider, task));
              continue;
            }
            if (decision === 'skip') continue;
            if (decision === 'reuse') {
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
            queue.push({ provider, task, workKey });
          }
        }
        for (const key of refreshKeys) if (!eligibleKeys.has(key)) refreshKeys.delete(key);
        if (!refreshAccess && !queue.length) {
          await preparedTimeZone;
          if (timeZoneError) throw timeZoneError;
          check();
          schedule.save();
          if (!failed.length && (preparingTimeZone || previousStatus.phase === 'failed'))
            publishRun({ phase: 'complete', incomplete: [] });
          return;
        }
        let reason: DownloadStatus['reason'];
        const incomplete = new Map(
          queue.map(({ provider, task, workKey }) => [workKey, downloadEntry(provider, task)]),
        );
        publishRun({
          phase: 'running',
          incomplete: [...incomplete.values()],
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
                incomplete: [...incomplete.values()],
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
                  incomplete: [...incomplete.values()],
                  reason: 'offline',
                  accessFailed: false,
                });
                controller.abort();
                throw error;
              }
              if (isAxiosError(error) && error.code === AxiosError.ECONNABORTED) reason = 'timeout';
              else reason ??= 'read';
              schedule.failed(workKey);
              failed.push(downloadEntry(provider, task));
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
                incomplete: failed,
                reason: reason ?? 'read',
                accessFailed: false,
              }
            : { phase: 'complete', incomplete: [] },
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
  const readFreshAccess = async (force = false) => {
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
      const readers = dependencies.access(config, check, 'upload');
      const saved = await refreshOfflineAccess(readers, check);
      check();
      freshAccess = { epoch, saved };
      return saved;
    });
  };
  setDownloadStatus({ phase: 'idle', incomplete: [] });
  setDownloadRetry(() => {
    void run('retry');
  });
  const refreshOfflineDownload = (refreshKey: string) => {
    refreshKeys.add(refreshKey);
    void run('refresh');
  };
  const unsubscribe = onSessionResumed({
    onUserChange: () => {
      stopActive();
      channel.close();
      refreshKeys.clear();
      setDownloadStatus({ phase: 'idle', incomplete: [] });
    },
    onExpired: () => stopActive('session'),
    onResume: () => {
      void run('force');
    },
  });
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribeOnline = onlineManager.subscribe((online) => {
    clearTimeout(reconnectTimer);
    if (online) reconnectTimer = setTimeout(() => void run('force'), 250);
    else stopActive('offline');
  });
  const accessValues = new Map<string, string>();
  const observesAccess = ([resource, part, id]: readonly unknown[]) => {
    const userId = useLoginData.getState().referenceDataUserId;
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
  const stop = () => {
    stopped = true;
    stopActive();
    unsubscribe();
    unsubscribeOnline();
    unsubscribeAccess();
    clearInterval(freshnessTimer);
    clearTimeout(reconnectTimer);
    channel.close();
    setDownloadRetry();
  };
  return { stop, freshAccess: readFreshAccess, refresh: refreshOfflineDownload };
}
