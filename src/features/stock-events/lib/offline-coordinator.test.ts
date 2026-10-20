import { onlineManager } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { downloadIsStale } from '@/features/stock-events/lib/download-read';
import type { HomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import { homeStockProvider } from '@/features/stock-events/lib/home-stock-provider';
import { client } from '@/integrations/axios';
import { getLocalDb } from '@/integrations/local-db';
import { queryClient } from '@/integrations/tanstack-query';
import { downloadSchedule } from '@/lib/download-schedule';
import { userProgramsKey } from '@/lib/key-factory';
import type { AccessReaders } from '@/lib/offline-access';
import { startOfflineCoordinator } from '@/lib/offline-coordinator';
import {
  getDownloadStatus,
  refreshOfflineProgram,
  retryOfflineDownload,
  setDownloadStatus,
} from '@/lib/offline-download-status';
import { parsePermissions } from '@/lib/permissions';

const programs = ['p1', 'p2'].map((id) => ({ id, code: id, name: id, active: true }));
const raw: AccessReaders = {
  permissions: vi.fn(async () =>
    programs.flatMap(({ id }) => [`STOCK_ADJUST|home|${id}`, `STOCK_CARDS_VIEW|home|${id}`]),
  ),
  user: vi.fn(async () => ({
    id: 'downloader',
    username: 'user',
    firstName: '',
    lastName: '',
    active: true,
    homeFacilityId: 'home',
    roleAssignments: [],
  })),
  programs: vi.fn(async () => programs),
  home: vi.fn(async () => ({
    id: 'home',
    code: 'HOME',
    name: 'Home',
    active: true,
    enabled: true,
    type: { id: 'type', code: 'TYPE', name: 'Type' },
    geographicZone: { id: 'zone', code: 'ZONE', name: 'Zone', level: { name: 'District' } },
    supportedPrograms: programs.map((program) => ({
      ...program,
      supportActive: true,
      supportLocallyFulfilled: true,
    })),
  })),
};
const bundle = (programId: string): HomeStockBundle => ({
  userId: 'downloader',
  facilityId: 'home',
  programId,
  facilityTypeId: 'type',
  scanning: false,
  generation: crypto.randomUUID(),
  fetchedAt: Date.now(),
  formatVersion: 3,
  summaries: [],
  products: [],
  cards: [],
  reasons: [],
  tradeItems: [],
  identities: [],
});
let stop: (() => void) | undefined;
const originalAdapter = client.defaults.adapter;
let download: ReturnType<
  typeof vi.fn<(filter: { programId: string }, signal?: AbortSignal) => Promise<HomeStockBundle>>
>;
beforeEach(async () => {
  localStorage.removeItem('openlmis-ui.time-zone');
  queryClient.clear();
  client.defaults.adapter = async (config) => ({
    data: { timeZoneId: 'Africa/Blantyre' },
    status: 200,
    statusText: 'OK',
    config,
    headers: {},
  });
  onlineManager.setOnline(true);
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'downloader', username: 'user', accessToken: 'token' });
  localStorage.removeItem(`${getLocalDb().name}:download-schedule`);
  await getLocalDb().table('offlineAccess').clear();
  await getLocalDb().table('homeStockDownloads').clear();
  vi.stubGlobal('navigator', {
    locks: { request: vi.fn(async (_name, _options, run) => run({})) },
  });
  download = vi.fn(async ({ programId }) => bundle(programId));
});
afterEach(() => {
  stop?.();
  stop = undefined;
  useLoginData.getState().clearLoginData();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  client.defaults.adapter = originalAdapter;
  localStorage.removeItem('openlmis-ui.time-zone');
  vi.useRealTimers();
});
const begin = () => {
  stop = startOfflineCoordinator({ access: raw, providers: [homeStockProvider(download)] });
};
const finished = () => waitFor(() => expect(getDownloadStatus().phase).toBe('complete'));

it('persists the deployment time zone before reporting offline data ready', async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  client.defaults.adapter = async (config) => {
    await held;
    return {
      data: { timeZoneId: 'Africa/Blantyre' },
      status: 200,
      statusText: 'OK',
      config,
      headers: {},
    };
  };
  begin();
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  expect(getDownloadStatus().phase).not.toBe('complete');
  release();
  await finished();
  expect(localStorage.getItem('openlmis-ui.time-zone')).toBe('Africa/Blantyre');
});

it('refreshes aging data while remaining online without a navigation or reconnect', async () => {
  const scheduled = vi.spyOn(globalThis, 'setInterval');
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  begin();
  await finished();
  await vi.mocked(navigator.locks.request).mock.results.at(-1)?.value;
  await getLocalDb().table('homeStockDownloads').toArray();
  const checkFreshness = scheduled.mock.calls.find(
    ([, delay]) => delay === 60_000,
  )?.[0] as () => void;
  expect(checkFreshness).toBeTypeOf('function');
  download.mockClear();
  clock.mockReturnValue(now + 29 * 60 * 1000);
  checkFreshness();
  await getLocalDb().table('offlineAccess').get('downloader');
  expect(navigator.locks.request).toHaveBeenCalledTimes(1);
  await getLocalDb().table('homeStockDownloads').toArray();
  expect(download).not.toHaveBeenCalled();
  clock.mockReturnValue(now + 30 * 60 * 1000);
  checkFreshness();
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  await finished();
  expect(await getLocalDb().table('homeStockDownloads').get(['home', 'p1'])).toMatchObject({
    fetchedAt: Date.now(),
  });
});

it('refreshes changed access while retaining still-eligible fresh programs', async () => {
  queryClient.setQueryData(userProgramsKey('downloader'), programs);
  begin();
  await finished();
  download.mockClear();
  vi.mocked(raw.programs).mockResolvedValueOnce([programs[1]]);
  queryClient.setQueryData(userProgramsKey('downloader'), [programs[1]]);
  await waitFor(async () =>
    expect(await getLocalDb().table('offlineAccess').get('downloader')).toMatchObject({
      programs: [programs[1]],
    }),
  );
  await finished();
  expect(download).not.toHaveBeenCalled();
  expect(await getLocalDb().table('offlineAccess').get('downloader')).toMatchObject({
    programs: [programs[1]],
  });
});

it('rechecks home facility type and scoped rights after authoritative reads', async () => {
  const home = await raw.home('home');
  queryClient.setQueryData(['facilities', 'home', 'home'], home);
  queryClient.setQueryData(
    ['auth', 'rights', 'downloader'],
    parsePermissions(await raw.permissions('downloader')),
  );
  begin();
  await finished();
  download.mockClear();
  const changed = { ...home, type: { ...home.type, id: 'new-type' } };
  vi.mocked(raw.home).mockResolvedValueOnce(changed);
  download.mockImplementation(async (scope) => ({
    ...bundle(scope.programId),
    facilityTypeId: 'new-type',
  }));
  queryClient.setQueryData(['facilities', 'home', 'home'], changed);
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  await finished();
  expect(await getLocalDb().table('homeStockDownloads').get(['home', 'p1'])).toMatchObject({
    facilityTypeId: 'new-type',
  });
  download.mockClear();
  vi.mocked(raw.permissions).mockResolvedValueOnce([]);
  queryClient.setQueryData(['auth', 'rights', 'downloader'], parsePermissions([]));
  await waitFor(async () =>
    expect(await getLocalDb().table('offlineAccess').get('downloader')).toMatchObject({
      permissionStrings: [],
    }),
  );
  await finished();
  expect(download).not.toHaveBeenCalled();
});

it('keeps downloaded data usable with UTC when locale settings are unavailable', async () => {
  const zoneRead = vi.fn(async () => {
    throw new Error('Locale settings unavailable');
  });
  client.defaults.adapter = zoneRead;
  begin();
  await finished();
  expect(localStorage.getItem('openlmis-ui.time-zone')).toBe('UTC');
  expect(await getLocalDb().table('homeStockDownloads').count()).toBe(2);
  expect(zoneRead).toHaveBeenCalledOnce();
});

it('retains a stored time zone on refresh failure and clears an earlier failure on an empty retry', async () => {
  localStorage.setItem('openlmis-ui.time-zone', 'Africa/Blantyre');
  client.defaults.adapter = async () => {
    throw new Error('Locale settings unavailable');
  };
  begin();
  await finished();
  expect(localStorage.getItem('openlmis-ui.time-zone')).toBe('Africa/Blantyre');
  setDownloadStatus({ phase: 'failed', incompletePrograms: [], reason: 'read' });
  retryOfflineDownload();
  await finished();
  expect(download).toHaveBeenCalledTimes(2);
});

it('returns immediately with a held download, commits only complete programs and retains old generations on failure', async () => {
  let release!: (value: HomeStockBundle) => void;
  download.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await getLocalDb().table('physicalInventoryDrafts').put({ draftId: 'retained-pi', counted: 4 });
  begin();
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  expect(getDownloadStatus().phase).toBe('running');
  expect(await getLocalDb().table('homeStockDownloads').get(['home', 'p1'])).toBeUndefined();
  release(bundle('p1'));
  await finished();
  const old = await getLocalDb().table('homeStockDownloads').get(['home', 'p1']);
  download.mockRejectedValueOnce(new AxiosError('Timed out', AxiosError.ECONNABORTED));
  onlineManager.setOnline(false);
  onlineManager.setOnline(true);
  await waitFor(() => expect(getDownloadStatus().phase).toBe('failed'));
  expect(getDownloadStatus().reason).toBe('timeout');
  expect(getDownloadStatus().incompletePrograms.map((program) => program.id)).toEqual(['p1']);
  expect(await getLocalDb().table('homeStockDownloads').get(['home', 'p1'])).toEqual(old);
  expect(await getLocalDb().table('physicalInventoryDrafts').get('retained-pi')).toEqual({
    draftId: 'retained-pi',
    counted: 4,
  });
  download.mockClear();
  retryOfflineDownload();
  await finished();
  expect(download.mock.calls.map(([filter]) => filter.programId)).toEqual(['p1']);
});

it('restored boot reuses young data and refreshes only missing or 30-minute-stale programs', async () => {
  begin();
  await finished();
  stop?.();
  download.mockClear();
  const table = getLocalDb().table('homeStockDownloads');
  await table.update(['home', 'p1'], { fetchedAt: Date.now() - 30 * 60 * 1000 });
  await table.update(['home', 'p2'], { fetchedAt: Date.now() - 29 * 60 * 1000 });
  begin();
  await finished();
  expect(download.mock.calls.map(([filter]) => filter.programId)).toEqual(['p1']);
  stop?.();
  download.mockClear();
  await table.delete(['home', 'p2']);
  begin();
  await finished();
  expect(download.mock.calls.map(([filter]) => filter.programId)).toEqual(['p2']);
});

it('forces fresh sign-in downloads even when saved bundles are young', async () => {
  begin();
  await finished();
  stop?.();
  download.mockClear();
  stop = startOfflineCoordinator({
    access: raw,
    providers: [homeStockProvider(download)],
    initialTrigger: 'force',
  });
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  await finished();
});

it('forces refresh on reconnect and same-user renewal even for young bundles', async () => {
  begin();
  await finished();
  download.mockClear();
  onlineManager.setOnline(false);
  onlineManager.setOnline(true);
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  await finished();
  download.mockClear();
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'downloader', username: 'user', accessToken: 'renewed' });
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  await finished();
});

it.each(['identity', 'expiry', 'offline'] as const)(
  'stops a held batch on %s and never publishes its late response',
  async (cause) => {
    let release!: (value: HomeStockBundle) => void;
    download.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    begin();
    await waitFor(() => expect(download).toHaveBeenCalled());
    if (cause === 'identity') useLoginData.getState().clearLoginData();
    if (cause === 'expiry') useLoginData.getState().expireSession();
    if (cause === 'offline') onlineManager.setOnline(false);
    await waitFor(() => expect(getDownloadStatus().phase).not.toBe('running'));
    release(bundle('p2'));
    await Promise.resolve();
    if (cause === 'identity')
      useLoginData.getState().setLoginData({
        referenceDataUserId: 'downloader',
        username: 'user',
        accessToken: 'token',
      });
    expect(await getLocalDb().table('homeStockDownloads').count()).toBe(0);
  },
);

it('disables download without Web Locks', async () => {
  vi.stubGlobal('navigator', {});
  begin();
  await waitFor(() => expect(getDownloadStatus().phase).toBe('unsupported'));
  expect(download).not.toHaveBeenCalled();
});

it('rechecks generations under the shared lock instead of duplicating a completed batch', async () => {
  const originalRequest = navigator.locks.request;
  let lockTail = Promise.resolve();
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name: string, _options: unknown, task: () => Promise<void>) => {
        const next = lockTail.then(task);
        lockTail = next.catch(() => undefined);
        return next;
      },
    },
  });
  let release!: (value: HomeStockBundle) => void;
  download.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  begin();
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  const secondDownload = vi.fn(async ({ programId }: { programId: string }) => bundle(programId));
  const secondStop = startOfflineCoordinator({
    access: raw,
    providers: [homeStockProvider(secondDownload)],
  });
  try {
    release(bundle('p1'));
    await lockTail;
    await finished();
    expect(secondDownload).not.toHaveBeenCalled();
  } finally {
    secondStop();
    vi.stubGlobal('navigator', { locks: { request: originalRequest } });
  }
});

it('stops unfinished scopes on a no-response connection failure even when the browser reports online', async () => {
  download.mockRejectedValue(new AxiosError('Connection lost', AxiosError.ERR_NETWORK));
  begin();
  await waitFor(() => expect(getDownloadStatus().phase).toBe('failed'));
  expect(getDownloadStatus().reason).toBe('offline');
  expect(getDownloadStatus().incompletePrograms.map((program) => program.id)).toEqual(['p1', 'p2']);
  expect(await getLocalDb().table('homeStockDownloads').count()).toBe(0);
  expect(onlineManager.isOnline()).toBe(true);
});

it('keeps an entirely fresh boot idle without publishing download announcements', async () => {
  begin();
  await finished();
  stop?.();
  download.mockClear();
  const messages = vi.fn();
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      postMessage = messages;
      close() {}
    },
  );
  begin();
  await waitFor(() => expect(navigator.locks.request).toHaveBeenCalledTimes(2));
  await getLocalDb().table('homeStockDownloads').toArray();
  expect(download).not.toHaveBeenCalled();
  expect(messages.mock.calls.some(([message]) => message.type === 'status')).toBe(false);
  expect(getDownloadStatus().phase).toBe('idle');
});

it('excludes programs without stock viewing rights from downloads and Retry failures', async () => {
  vi.mocked(raw.permissions).mockResolvedValueOnce([
    'STOCK_ADJUST|home|p1',
    'STOCK_ADJUST|home|p2',
    'STOCK_CARDS_VIEW|home|p2',
  ]);
  begin();
  await finished();
  expect(download.mock.calls.map(([filter]) => filter.programId)).toEqual(['p2']);
  expect(getDownloadStatus().incompletePrograms).toEqual([]);
  expect(await getLocalDb().table('homeStockDownloads').get(['home', 'p1'])).toBeUndefined();
});

it.each([false, true])(
  'settles remote running status when its lock releases, final status received: %s',
  async (final) => {
    begin();
    await finished();
    stop?.();
    let receive!: (event: { data: unknown }) => void;
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        set onmessage(value: typeof receive) {
          receive = value;
        }
        postMessage() {}
        close() {}
      },
    );
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(navigator.locks.request).mockImplementation(async (_name, options, task) => {
      if (options && 'mode' in options && options.mode === 'shared') await held;
      return task({} as Lock);
    });
    begin();
    await waitFor(() => expect(receive).toBeTypeOf('function'));
    receive({
      data: {
        type: 'status',
        status: { phase: 'running', incompletePrograms: [{ id: 'p1', name: 'p1' }] },
      },
    });
    await waitFor(() =>
      expect(navigator.locks.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ mode: 'shared' }),
        expect.any(Function),
      ),
    );
    release();
    if (final) {
      let phaseBeforeFinal = getDownloadStatus().phase;
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          phaseBeforeFinal = getDownloadStatus().phase;
          receive({
            data: { type: 'status', status: { phase: 'complete', incompletePrograms: [] } },
          });
          resolve();
        }, 0),
      );
      expect(phaseBeforeFinal).toBe('running');
    }
    await waitFor(() => expect(getDownloadStatus().phase).toBe(final ? 'complete' : 'failed'));
  },
);

it('marks accepted online stock stale and refreshes only that program without waiting for the read', async () => {
  begin();
  await finished();
  expect(getDownloadStatus().trigger).toBe('boot');
  download.mockClear();
  const previous = await getLocalDb().table('homeStockDownloads').get(['home', 'p1']);
  let release!: (value: HomeStockBundle) => void;
  download.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  refreshOfflineProgram({ facilityId: 'home', programId: 'p1' });
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  expect(getDownloadStatus()).toMatchObject({ phase: 'running', trigger: 'refresh' });
  expect(download.mock.calls[0][0].programId).toBe('p1');
  const stale = await getLocalDb().table('homeStockDownloads').get(['home', 'p1']);
  expect(stale).toMatchObject({ stale: true, fetchedAt: previous.fetchedAt });
  expect(downloadIsStale(stale)).toBe(true);
  release(bundle('p1'));
  await finished();
  expect(getDownloadStatus().trigger).toBe('refresh');
  expect((await getLocalDb().table('homeStockDownloads').get(['home', 'p1'])).stale).not.toBe(true);
});

it('keeps a queued user retry visible when a later accepted-event refresh joins the batch', async () => {
  begin();
  await finished();
  let release!: (value: HomeStockBundle) => void;
  download.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  refreshOfflineProgram({ facilityId: 'home', programId: 'p1' });
  await waitFor(() =>
    expect(getDownloadStatus()).toMatchObject({ phase: 'running', trigger: 'refresh' }),
  );
  retryOfflineDownload();
  refreshOfflineProgram({ facilityId: 'home', programId: 'p2' });
  release(bundle('p1'));
  await waitFor(() =>
    expect(getDownloadStatus()).toMatchObject({ phase: 'complete', trigger: 'retry' }),
  );
});

it('queues a submitted program refresh behind an older in-flight batch', async () => {
  let release!: (value: HomeStockBundle) => void;
  download.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  begin();
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  refreshOfflineProgram({ facilityId: 'home', programId: 'p1' });
  release(bundle('p1'));
  await waitFor(() => expect(download).toHaveBeenCalledTimes(3));
  await finished();
  expect(download.mock.calls.map(([filter]) => filter.programId)).toEqual(['p1', 'p2', 'p1']);
});

it('drops refresh requests outside eligible home programs so an observed completion satisfies later triggers', async () => {
  vi.mocked(raw.permissions).mockResolvedValueOnce([
    'STOCK_ADJUST|home|p1',
    'STOCK_ADJUST|home|p2',
    'STOCK_CARDS_VIEW|home|p2',
  ]);
  let receive!: (event: { data: unknown }) => void;
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      set onmessage(value: typeof receive) {
        receive = value;
      }
      postMessage() {}
      close() {}
    },
  );
  let completedLocks = 0;
  let remoteCompletion = false;
  vi.mocked(navigator.locks.request).mockImplementation(async (_name, _options, task) => {
    if (remoteCompletion) {
      receive({ data: { type: 'status', status: { phase: 'running', incompletePrograms: [] } } });
      receive({ data: { type: 'status', status: { phase: 'complete', incompletePrograms: [] } } });
    }
    const result = await task({} as Lock);
    completedLocks += 1;
    return result;
  });
  begin();
  await finished();
  await waitFor(() => expect(completedLocks).toBe(1));
  download.mockClear();
  refreshOfflineProgram({ facilityId: 'away', programId: 'p2' });
  await waitFor(() => expect(completedLocks).toBe(2));
  refreshOfflineProgram({ facilityId: 'home', programId: 'p1' });
  await waitFor(() => expect(completedLocks).toBe(3));
  remoteCompletion = true;
  onlineManager.setOnline(false);
  onlineManager.setOnline(true);
  await waitFor(() => expect(completedLocks).toBeGreaterThanOrEqual(4));
  expect(download).not.toHaveBeenCalled();
});

it('refreshes a cached upload snapshot explicitly without a token or connection change', async () => {
  vi.mocked(navigator.locks.request).mockImplementation(async (_name, ...args) => {
    const action = args.at(-1) as () => Promise<unknown>;
    return action();
  });
  begin();
  await finished();
  const { freshUploadAccess } = await import('@/lib/upload-access');
  const first = await freshUploadAccess();
  vi.mocked(raw.permissions).mockResolvedValueOnce([]);
  expect((await freshUploadAccess()).generation).toBe(first.generation);
  expect((await freshUploadAccess(true)).permissionStrings).toEqual([]);
});

it('isolates provider failures and retries only the failed dataset when scope ids overlap', async () => {
  const { defineDownloadProvider } = await import('@/lib/download-provider');
  const first = vi.fn(async () => ({ ...bundle('same'), generation: 'first' }));
  first.mockRejectedValueOnce(new Error('Read failed'));
  const second = vi.fn(async () => ({
    userId: 'downloader',
    generation: 'second',
    fetchedAt: Date.now(),
    draftId: 'provider-record',
  }));
  const providers = [
    defineDownloadProvider({
      id: 'first',
      label: 'offline.download.home-stock',
      table: 'homeStockDownloads',
      eligible: () => true,
      scopes: () => [{ id: 'same', name: 'Same', key: ['home', 'same'] }],
      fetch: first,
      accepts: () => true,
      isFresh: () => false,
    }),
    defineDownloadProvider({
      id: 'second',
      label: 'offline.download.home-stock',
      table: 'physicalInventoryDrafts',
      eligible: () => true,
      scopes: () => [{ id: 'same', name: 'Same', key: 'provider-record' }],
      fetch: second,
      accepts: () => true,
      isFresh: () => false,
    }),
  ];
  stop = startOfflineCoordinator({ access: raw, providers });
  await waitFor(() => expect(getDownloadStatus().phase).toBe('failed'));
  expect(getDownloadStatus().incompletePrograms).toEqual([
    { id: 'same', name: 'Same', dataset: 'first', datasetLabel: 'offline.download.home-stock' },
  ]);
  expect(await getLocalDb().table('physicalInventoryDrafts').get('provider-record')).toMatchObject({
    generation: 'second',
  });
  retryOfflineDownload();
  await finished();
  expect(first).toHaveBeenCalledTimes(2);
  expect(second).toHaveBeenCalledTimes(1);
  expect(await getLocalDb().table('homeStockDownloads').get(['home', 'same'])).toMatchObject({
    generation: 'first',
  });
});

it('compares generations by the full storage key when another facility has the same program', async () => {
  await getLocalDb()
    .table('homeStockDownloads')
    .bulkPut([
      { ...bundle('p1'), generation: 'home-generation', fetchedAt: 0 },
      { ...bundle('p1'), facilityId: 'z-away', generation: 'away-generation', fetchedAt: 0 },
    ]);
  begin();
  await finished();
  expect(download.mock.calls.map(([scope]) => scope.programId)).toEqual(['p1', 'p2']);
  expect(await getLocalDb().table('homeStockDownloads').get(['z-away', 'p1'])).toMatchObject({
    generation: 'away-generation',
  });
});

it('does not cancel or repeat downloads when access queries first populate an empty cache', async () => {
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  let release!: (value: HomeStockBundle) => void;
  download.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  begin();
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  const signal = download.mock.calls[0][1];
  queryClient.setQueryData(userProgramsKey('downloader'), programs);
  queryClient.setQueryData(
    ['auth', 'rights', 'downloader'],
    parsePermissions(await raw.permissions('downloader')),
  );
  queryClient.setQueryData(['users', 'record', 'downloader'], await raw.user('downloader'));
  queryClient.setQueryData(['facilities', 'home', 'home'], await raw.home('home'));
  release(bundle('p1'));
  await finished();
  await getLocalDb().table('offlineAccess').get('downloader');
  expect(signal?.aborted).toBe(false);
  expect(download).toHaveBeenCalledTimes(2);
});

it('shares freshness scheduling and exponential failure backoff across two coordinators', async () => {
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const intervals = vi.spyOn(globalThis, 'setInterval');
  let tail = Promise.resolve();
  vi.mocked(navigator.locks.request).mockImplementation((_name, _options, task) => {
    const next = tail.then(() => task({} as Lock));
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  });
  begin();
  await finished();
  await tail;
  const second = vi.fn(async ({ programId }: { programId: string }) => bundle(programId));
  const secondStop = startOfflineCoordinator({
    access: raw,
    providers: [homeStockProvider(second)],
  });
  try {
    await waitFor(() => expect(navigator.locks.request).toHaveBeenCalledTimes(2));
    await tail;
    const ticks = intervals.mock.calls
      .filter(([, delay]) => delay === 60_000)
      .map(([tick]) => tick as () => void);
    const reads = vi.spyOn(getLocalDb().table('homeStockDownloads'), 'bulkGet');
    const locks = vi.mocked(navigator.locks.request).mock.calls.length;
    clock.mockReturnValue(now + 60_000);
    for (const tick of ticks) tick();
    await getLocalDb().table('offlineAccess').get('downloader');
    expect(reads).not.toHaveBeenCalled();
    expect(navigator.locks.request).toHaveBeenCalledTimes(locks);
    download.mockRejectedValue(new Error('Program down'));
    second.mockRejectedValue(new Error('Program down'));
    clock.mockReturnValue(now + 30 * 60_000);
    for (const tick of ticks) tick();
    await waitFor(() => expect(getDownloadStatus().phase).toBe('failed'));
    await tail;
    expect(download.mock.calls.length + second.mock.calls.length).toBe(4);
    clock.mockReturnValue(now + 31 * 60_000);
    for (const tick of ticks) tick();
    await waitFor(() => expect(download.mock.calls.length + second.mock.calls.length).toBe(6));
    await tail;
    clock.mockReturnValue(now + 32 * 60_000);
    for (const tick of ticks) tick();
    await getLocalDb().table('offlineAccess').get('downloader');
    await tail;
    expect(download.mock.calls.length + second.mock.calls.length).toBe(6);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    clock.mockReturnValue(now + 35 * 60_000);
    for (const tick of ticks) tick();
    await getLocalDb().table('offlineAccess').get('downloader');
    expect(download.mock.calls.length + second.mock.calls.length).toBe(6);
  } finally {
    secondStop();
  }
});

it('coalesces rapid reconnect hints into one forced download', async () => {
  begin();
  await finished();
  download.mockClear();
  for (let i = 0; i < 3; i++) {
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
  }
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  await finished();
  await getLocalDb().table('offlineAccess').get('downloader');
  expect(download).toHaveBeenCalledTimes(2);
});

it('announces UTC fallback once while two tabs keep downloaded data ready without minute-by-minute locale retries', async () => {
  const intervals = vi.spyOn(globalThis, 'setInterval');
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const zoneRead = vi.fn(async () => {
    throw new Error('Locale settings unavailable');
  });
  client.defaults.adapter = zoneRead;
  const note = vi.fn();
  stop = startOfflineCoordinator({
    access: raw,
    providers: [homeStockProvider(download)],
    onTimeZoneFallback: note,
  });
  await finished();
  const secondStop = startOfflineCoordinator({
    access: raw,
    providers: [homeStockProvider(download)],
    onTimeZoneFallback: note,
  });
  try {
    await waitFor(() => expect(navigator.locks.request).toHaveBeenCalledTimes(2));
    await vi.mocked(navigator.locks.request).mock.results.at(-1)?.value;
    clock.mockReturnValue(now + 2 * 60_000);
    for (const [tick, delay] of intervals.mock.calls)
      if (delay === 60_000 && typeof tick === 'function') tick();
    await getLocalDb().table('offlineAccess').get('downloader');
    expect(zoneRead).toHaveBeenCalledOnce();
    expect(note).toHaveBeenCalledOnce();
    expect(await getLocalDb().table('homeStockDownloads').count()).toBe(2);
  } finally {
    secondStop();
  }
});

it.each([undefined, 'Africa/Blantyre'])(
  'keeps stock preparation online when only locale settings is unreachable with stored zone %s',
  async (zone) => {
    if (zone) localStorage.setItem('openlmis-ui.time-zone', zone);
    const zoneRead = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('Locale service unreachable', AxiosError.ERR_NETWORK, config);
    });
    client.defaults.adapter = zoneRead;
    begin();
    await waitFor(() => expect(zoneRead).toHaveBeenCalledOnce());
    expect(onlineManager.isOnline()).toBe(true);
    await finished();
    expect(localStorage.getItem('openlmis-ui.time-zone')).toBe(zone ?? 'UTC');
    expect(await getLocalDb().table('homeStockDownloads').count()).toBe(2);
  },
);

it('backs off periodic access failures across tabs before reading bundles or requesting access again', async () => {
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const intervals = vi.spyOn(globalThis, 'setInterval');
  let tail = Promise.resolve();
  vi.mocked(navigator.locks.request).mockImplementation((_name, _options, task) => {
    const next = tail.then(() => task({} as Lock));
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  });
  begin();
  await finished();
  await tail;
  const secondStop = startOfflineCoordinator({
    access: raw,
    providers: [homeStockProvider(download)],
  });
  try {
    await waitFor(() => expect(navigator.locks.request).toHaveBeenCalledTimes(2));
    await tail;
    vi.mocked(raw.permissions).mockRejectedValue(new Error('Access unavailable'));
    vi.mocked(raw.permissions).mockClear();
    const ticks = intervals.mock.calls
      .filter(([, delay]) => delay === 60_000)
      .map(([tick]) => tick as () => void);
    const reads = vi.spyOn(getLocalDb().table('homeStockDownloads'), 'bulkGet');
    clock.mockReturnValue(now + 30 * 60_000);
    for (const tick of ticks) tick();
    await waitFor(() => expect(getDownloadStatus().phase).toBe('failed'));
    await tail;
    expect(raw.permissions).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(now + 31 * 60_000);
    for (const tick of ticks) tick();
    await waitFor(() => expect(raw.permissions).toHaveBeenCalledTimes(2));
    await tail;
    reads.mockClear();
    clock.mockReturnValue(now + 32 * 60_000);
    for (const tick of ticks) tick();
    await getLocalDb().table('offlineAccess').get('downloader');
    await tail;
    expect(reads).not.toHaveBeenCalled();
    expect(raw.permissions).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(now + 33 * 60_000);
    for (const tick of ticks) tick();
    await waitFor(() => expect(raw.permissions).toHaveBeenCalledTimes(3));
    await tail;
    retryOfflineDownload();
    await waitFor(() => expect(raw.permissions).toHaveBeenCalledTimes(4));
    await tail;
    vi.mocked(raw.permissions).mockResolvedValue(
      programs.flatMap(({ id }) => [`STOCK_ADJUST|home|${id}`, `STOCK_CARDS_VIEW|home|${id}`]),
    );
    retryOfflineDownload();
    await finished();
    await tail;
    expect(downloadSchedule(getLocalDb().name).retryAt('access')).toBe(0);
  } finally {
    secondStop();
    vi.mocked(raw.permissions).mockImplementation(async () =>
      programs.flatMap(({ id }) => [`STOCK_ADJUST|home|${id}`, `STOCK_CARDS_VIEW|home|${id}`]),
    );
  }
});
