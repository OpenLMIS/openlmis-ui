import { onlineManager } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startOfflineCoordinator } from '@/components/offline-coordinator';
import { useLoginData } from '@/features/auth/store/login-data';
import { getLocalDb } from '@/integrations/local-db';
import { type AdjustmentBundle, downloadIsStale } from '@/lib/adjustment-bundle';
import type { AccessReaders } from '@/lib/offline-access';
import {
  getDownloadStatus,
  refreshOfflineProgram,
  retryOfflineDownload,
} from '@/lib/offline-download-status';

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
const bundle = (programId: string): AdjustmentBundle => ({
  userId: 'downloader',
  facilityId: 'home',
  programId,
  facilityTypeId: 'type',
  scanning: false,
  generation: crypto.randomUUID(),
  fetchedAt: Date.now(),
  formatVersion: 1,
  cards: [],
  reasons: [],
  tradeItems: [],
  identities: [],
});
let stop: (() => void) | undefined;
let download: ReturnType<
  typeof vi.fn<(filter: { programId: string }) => Promise<AdjustmentBundle>>
>;
beforeEach(async () => {
  onlineManager.setOnline(true);
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'downloader', username: 'user', accessToken: 'token' });
  await getLocalDb().table('offlineAccess').clear();
  await getLocalDb().table('adjustmentDownloads').clear();
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
});
const begin = () => {
  stop = startOfflineCoordinator({ access: raw, bundle: download });
};
const finished = () => waitFor(() => expect(getDownloadStatus().phase).toBe('complete'));

it('returns immediately with a held download, commits only complete programs and retains old generations on failure', async () => {
  let release!: (value: AdjustmentBundle) => void;
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
  expect(await getLocalDb().table('adjustmentDownloads').get(['home', 'p1'])).toBeUndefined();
  release(bundle('p1'));
  await finished();
  const old = await getLocalDb().table('adjustmentDownloads').get(['home', 'p1']);
  download.mockRejectedValueOnce(new AxiosError('Timed out', AxiosError.ECONNABORTED));
  onlineManager.setOnline(false);
  onlineManager.setOnline(true);
  await waitFor(() => expect(getDownloadStatus().phase).toBe('failed'));
  expect(getDownloadStatus().reason).toBe('timeout');
  expect(getDownloadStatus().failed.map((program) => program.id)).toEqual(['p1']);
  expect(await getLocalDb().table('adjustmentDownloads').get(['home', 'p1'])).toEqual(old);
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
  const table = getLocalDb().table('adjustmentDownloads');
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
    let release!: (value: AdjustmentBundle) => void;
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
    expect(await getLocalDb().table('adjustmentDownloads').count()).toBe(0);
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
  let release!: (value: AdjustmentBundle) => void;
  download.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  begin();
  await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  const secondDownload = vi.fn(async ({ programId }: { programId: string }) => bundle(programId));
  const secondStop = startOfflineCoordinator({ access: raw, bundle: secondDownload });
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
  expect(getDownloadStatus().failed.map((program) => program.id)).toEqual(['p1', 'p2']);
  expect(await getLocalDb().table('adjustmentDownloads').count()).toBe(0);
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
  await getLocalDb().table('adjustmentDownloads').toArray();
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
  expect(getDownloadStatus().failed).toEqual([]);
  expect(await getLocalDb().table('adjustmentDownloads').get(['home', 'p1'])).toBeUndefined();
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
      data: { type: 'status', status: { phase: 'running', failed: [{ id: 'p1', name: 'p1' }] } },
    });
    await waitFor(() =>
      expect(navigator.locks.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ mode: 'shared' }),
        expect.any(Function),
      ),
    );
    if (final) receive({ data: { type: 'status', status: { phase: 'complete', failed: [] } } });
    release();
    await waitFor(() => expect(getDownloadStatus().phase).toBe(final ? 'complete' : 'failed'));
  },
);

it('marks accepted online stock stale and refreshes only that program without waiting for the read', async () => {
  begin();
  await finished();
  download.mockClear();
  const previous = await getLocalDb().table('adjustmentDownloads').get(['home', 'p1']);
  let release!: (value: AdjustmentBundle) => void;
  download.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  refreshOfflineProgram({ facilityId: 'home', programId: 'p1' });
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  expect(download.mock.calls[0][0].programId).toBe('p1');
  const stale = await getLocalDb().table('adjustmentDownloads').get(['home', 'p1']);
  expect(stale).toMatchObject({ stale: true, fetchedAt: previous.fetchedAt });
  expect(downloadIsStale(stale)).toBe(true);
  release(bundle('p1'));
  await finished();
  expect((await getLocalDb().table('adjustmentDownloads').get(['home', 'p1'])).stale).not.toBe(
    true,
  );
});

it('queues a submitted program refresh behind an older in-flight batch', async () => {
  let release!: (value: AdjustmentBundle) => void;
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
