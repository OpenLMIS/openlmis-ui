import { onlineManager, QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import Dexie from 'dexie';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  getSyncPhase,
  useSyncPhase,
  wakeStockEventSync,
} from '@/features/stock-events/lib/device-event-status';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import type { ConfiguredEventKind } from '@/features/stock-events/lib/event-kinds';
import {
  refreshAfterStockEventAccepted,
  subscribeStockEventAcceptances,
} from '@/features/stock-events/lib/refresh-after-stock-event-accepted';
import { foregroundStockEvents } from '@/features/stock-events/lib/stock-event-delivery';
import {
  createStockEventContext,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import { enqueueStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import { startStockEventUploader } from '@/features/stock-events/lib/stock-event-uploader';
import { client } from '@/integrations/axios';
import i18n from '@/integrations/i18n';
import { getLocalDb } from '@/integrations/local-db';
import { queryClient } from '@/integrations/tanstack-query';
import { queryKeys } from '@/lib/key-factory';
import type { OfflineAccess } from '@/lib/offline-access';

vi.mock('@/features/stock-events/lib/event-kinds', async (original) => {
  const module = await original<typeof import('@/features/stock-events/lib/event-kinds')>();
  return {
    ...module,
    EVENT_KINDS: {
      ...module.EVENT_KINDS,
      issue: { ...module.EVENT_KINDS.issue, right: 'STOCK_ISSUE' },
    },
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
const owner = { referenceDataUserId: 'uploader', username: 'Ada', accessToken: 'first' };
const line = newEventLine(
  {
    orderable: { id: 'p', productCode: 'P', fullProductName: 'Product' },
    lot: null,
    stockOnHand: 20,
  },
  undefined,
  '2026-10-14',
  { kind: 'adjustment', productHasLots: false },
);
const snapshot = {
  userId: 'uploader',
  permissionStrings: ['STOCK_ADJUST|home|one'],
  homeFacility: { id: 'home' },
  programs: [{ id: 'one' }],
} as OfflineAccess;
const accepted = { status: 201, data: '11111111-1111-4111-8111-111111111111' };
const originalAdapter = client.defaults.adapter;
let stops: (() => void)[] = [];
beforeEach(async () => {
  useLoginData.getState().setLoginData(owner);
  onlineManager.setOnline(false);
  for (const table of [
    'stockEventDrafts',
    'stockEventQueue',
    'stockEventReceipts',
    'stockEventSyncErrors',
  ])
    await getLocalDb().table(table).clear();
  const tails = new Map<string, Promise<unknown>>();
  vi.stubGlobal('navigator', {
    locks: {
      request: vi.fn((name: string, ...args: unknown[]) => {
        const action = args.at(-1) as () => Promise<unknown>;
        const next = (tails.get(name) ?? Promise.resolve()).catch(() => {}).then(action);
        tails.set(name, next);
        return next;
      }),
    },
  });
});
afterEach(() => {
  for (const stop of stops) stop();
  stops = [];
  client.defaults.adapter = originalAdapter;
  vi.unstubAllGlobals();
});
async function enqueue(kind: ConfiguredEventKind = 'adjustment') {
  const context = createStockEventContext({
    kind,
    facilityId: 'home',
    programId: 'one',
  });
  const draft = await saveStockEventDraft(context, undefined, [line]);
  if (!draft) throw new Error('Missing draft');
  return enqueueStockEvent(
    context,
    draft,
    { facilityId: 'home', programId: 'one', lineItems: [] },
    {
      facility: { id: 'home', code: 'H', name: 'Home' },
      program: { id: 'one', code: 'one', name: 'One' },
    },
  );
}
it('waits for fresh access, orders enqueues, and two coordinators share one upload lock', async () => {
  const translated = vi.spyOn(i18n, 't');
  const first = await enqueue();
  const second = await enqueue();
  let releaseAccess!: (saved: OfflineAccess) => void;
  const access = vi.fn(
    () =>
      new Promise<OfflineAccess>((resolve) => {
        releaseAccess = resolve;
      }),
  );
  let releaseFirst!: (result: typeof accepted) => void;
  const send = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
    )
    .mockResolvedValue(accepted);
  stops.push(
    startStockEventUploader({ access, send }),
    startStockEventUploader({ access: async () => snapshot, send }),
  );
  onlineManager.setOnline(true);
  await waitFor(() => expect(access).toHaveBeenCalled());
  expect(send).not.toHaveBeenCalled();
  releaseAccess(snapshot);
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send.mock.calls[0][0].sequence).toBe(first.sequence);
  expect(await getLocalDb().table('stockEventReceipts').count()).toBe(0);
  releaseFirst(accepted);
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  expect(send.mock.calls[1][0].sequence).toBe(second.sequence);
  await waitFor(async () => expect(await getLocalDb().table('stockEventReceipts').count()).toBe(2));
  await waitFor(() => expect(getSyncPhase()).toBe('complete'));
  expect(toast.success).toHaveBeenCalledOnce();
  expect(translated).toHaveBeenCalledWith('offline-events.synced-count', { count: 2 });
});
it('a service 401 pauses until same-user renewal and fresh access, then resends exactly once', async () => {
  const event = await enqueue();
  const access = vi.fn(async () => snapshot);
  const send = vi
    .fn()
    .mockResolvedValueOnce({ status: 401, data: { error: 'invalid_token' } })
    .mockResolvedValue(accepted);
  stops.push(startStockEventUploader({ access, send }));
  onlineManager.setOnline(true);
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  await waitFor(async () =>
    expect((await getLocalDb().table('stockEventQueue').get(event.sequence)).status).toBe('queued'),
  );
  expect(await getLocalDb().table('stockEventReceipts').count()).toBe(0);
  useLoginData.getState().setLoginData({ ...owner, accessToken: 'renewed' });
  await waitFor(async () => expect(await getLocalDb().table('stockEventReceipts').count()).toBe(1));
  expect(send).toHaveBeenCalledTimes(2);
  expect(access).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][0].postBody).toBe(event.postBody);
});
it('fails closed without Web Locks and does not request access or send', async () => {
  await enqueue();
  vi.stubGlobal('navigator', {});
  const access = vi.fn(async () => snapshot);
  const send = vi.fn();
  const phase = renderHook(() => useSyncPhase());
  stops.push(startStockEventUploader({ access, send }));
  onlineManager.setOnline(true);
  await waitFor(() => expect(phase.result.current).toBe('unsupported'));
  expect(access).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
it('missing fresh grants pause the queue without dispatch or fake refusals, then recover', async () => {
  const event = await enqueue();
  const send = vi.fn(async () => accepted);
  const access = vi.fn(async () => ({ ...snapshot, permissionStrings: [] as string[] }));
  stops.push(startStockEventUploader({ access, send }));
  onlineManager.setOnline(true);
  await waitFor(async () =>
    expect((await getLocalDb().table('stockEventQueue').get(event.sequence)).pauseReason).toBe(
      'access-changed',
    ),
  );
  expect(send).not.toHaveBeenCalled();
  expect(await getLocalDb().table('stockEventSyncErrors').count()).toBe(0);
  expect((await getLocalDb().table('stockEventQueue').get(event.sequence)).postBody).toBe(
    event.postBody,
  );
  access.mockResolvedValue(snapshot);
  wakeStockEventSync();
  await waitFor(async () => expect(await getLocalDb().table('stockEventReceipts').count()).toBe(1));
  expect(send).toHaveBeenCalledOnce();
});

it('maps real transport refusals and saves a late acceptance in the original owner database', async () => {
  const refused = await enqueue();
  const ownerName = getLocalDb().name;
  let posts = 0;
  let answer!: () => void;
  client.defaults.adapter = async (config) => {
    expect(config.url).toBe('/stockEvents');
    expect(config.data).toBe(posts === 0 ? refused.postBody : acceptedEvent.postBody);
    posts++;
    if (posts === 1) {
      throw new AxiosError('Negative stock', AxiosError.ERR_BAD_REQUEST, config, undefined, {
        data: { messageKey: 'stockmanagement.error.event.debitQuantityExceedSoh' },
        status: 400,
        statusText: 'Bad Request',
        config,
        headers: {},
      });
    }
    await new Promise<void>((resolve) => {
      answer = resolve;
    });
    return { ...accepted, statusText: 'Created', config, headers: {} };
  };
  stops.push(startStockEventUploader({ access: async () => snapshot }));
  onlineManager.setOnline(true);
  await waitFor(async () =>
    expect(
      await getLocalDb().table('stockEventSyncErrors').get(refused.localEventId),
    ).toMatchObject({ category: 'stock-changed', httpStatus: 400 }),
  );
  const acceptedEvent = await enqueue();
  await waitFor(() => expect(answer).toBeTypeOf('function'));
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'other-uploader',
    username: 'Other',
    accessToken: 'other',
  });
  answer();
  const originalOwner = new Dexie(ownerName);
  try {
    await originalOwner.open();
    await waitFor(async () =>
      expect(
        await originalOwner
          .table('stockEventReceipts')
          .get([acceptedEvent.draftId, acceptedEvent.revision]),
      ).toMatchObject({ serverEventId: accepted.data }),
    );
    expect(await originalOwner.table('stockEventQueue').count()).toBe(0);
    expect(await getLocalDb().table('stockEventReceipts').count()).toBe(0);
    expect(posts).toBe(2);
  } finally {
    originalOwner.close();
  }
});

it('automatically retries preparation failures after its bounded delay without a reconnect or click', async () => {
  await enqueue();
  const access = vi.fn().mockRejectedValue(new Error('Preparation unavailable'));
  const send = vi.fn(async () => accepted);
  const timer = vi.spyOn(globalThis, 'setTimeout');
  stops.push(startStockEventUploader({ access, send }));
  onlineManager.setOnline(true);
  await waitFor(() => expect(timer.mock.calls.some(([, delay]) => delay === 1000)).toBe(true));
  expect(send).not.toHaveBeenCalled();
  access.mockResolvedValue(snapshot);
  const retry = timer.mock.calls.find(([, delay]) => delay === 1000)?.[0] as () => void;
  retry();
  await waitFor(async () => expect(await getLocalDb().table('stockEventReceipts').count()).toBe(1));
  expect(send).toHaveBeenCalledOnce();
});

it('requests fresh grants when an access-paused queue is focused or explicitly retried', async () => {
  const event = await enqueue();
  const access = vi.fn(async (_force?: boolean) => ({
    ...snapshot,
    permissionStrings: [] as string[],
  }));
  const send = vi.fn(async () => accepted);
  stops.push(startStockEventUploader({ access, send }));
  onlineManager.setOnline(true);
  await waitFor(async () =>
    expect((await getLocalDb().table('stockEventQueue').get(event.sequence)).pauseReason).toBe(
      'access-changed',
    ),
  );
  access.mockClear();
  window.dispatchEvent(new Event('focus'));
  await waitFor(() => expect(access).toHaveBeenCalledWith(true));
  access.mockResolvedValue(snapshot);
  wakeStockEventSync();
  await waitFor(async () => expect(await getLocalDb().table('stockEventReceipts').count()).toBe(1));
  expect(send).toHaveBeenCalledOnce();
});

it('refreshes access-paused scopes every thirty seconds and cancels that interval on stop', async () => {
  const interval = vi.spyOn(globalThis, 'setInterval');
  const clear = vi.spyOn(globalThis, 'clearInterval');
  const event = await enqueue();
  const access = vi.fn(async () => ({ ...snapshot, permissionStrings: [] as string[] }));
  const send = vi.fn(async () => accepted);
  const stop = startStockEventUploader({ access, send });
  stops.push(stop);
  onlineManager.setOnline(true);
  await waitFor(async () =>
    expect((await getLocalDb().table('stockEventQueue').get(event.sequence)).pauseReason).toBe(
      'access-changed',
    ),
  );
  await waitFor(() => expect(interval.mock.calls.some(([, delay]) => delay === 30000)).toBe(true));
  const timerIndex = interval.mock.calls.findIndex(([, delay]) => delay === 30000);
  const tick = interval.mock.calls[timerIndex][0] as () => void;
  access.mockClear();
  tick();
  await waitFor(() => expect(access).toHaveBeenCalledWith(true));
  expect(send).not.toHaveBeenCalled();
  stop();
  expect(clear).toHaveBeenCalledWith(interval.mock.results[timerIndex].value);
});

it('clears access polling on logout and does not force access for the next owner', async () => {
  const interval = vi.spyOn(globalThis, 'setInterval');
  const clear = vi.spyOn(globalThis, 'clearInterval');
  await enqueue();
  const access = vi.fn(async () => ({ ...snapshot, permissionStrings: [] as string[] }));
  stops.push(startStockEventUploader({ access, send: vi.fn(async () => accepted) }));
  onlineManager.setOnline(true);
  await waitFor(() => expect(interval.mock.calls.some(([, delay]) => delay === 30000)).toBe(true));
  const index = interval.mock.calls.findIndex(([, delay]) => delay === 30000);
  useLoginData.getState().clearLoginData();
  expect(clear).toHaveBeenCalledWith(interval.mock.results[index].value);
  access.mockClear();
  window.dispatchEvent(new Event('focus'));
  expect(access).not.toHaveBeenCalled();
});

it('does not report completion when a run accepts an event but leaves refused and uncertain work', async () => {
  await enqueue();
  await enqueue();
  await enqueue();
  const send = vi
    .fn()
    .mockResolvedValueOnce(accepted)
    .mockResolvedValueOnce({ status: 400, data: { messageKey: 'refused', message: 'Refused' } })
    .mockResolvedValueOnce({ status: 504, data: {} });
  stops.push(startStockEventUploader({ access: async () => snapshot, send }));
  onlineManager.setOnline(true);
  await waitFor(async () =>
    expect(await getLocalDb().table('stockEventSyncErrors').count()).toBe(2),
  );
  await waitFor(() => expect(getSyncPhase()).toBe('idle'));
  expect(await getLocalDb().table('stockEventReceipts').count()).toBe(1);
  expect((await getLocalDb().table('stockEventQueue').toArray())[0].status).toBe('uncertain');
});

it('requires the queued kind right, even when another offline kind is allowed at the same scope', async () => {
  const event = await enqueue('issue');
  let permissionStrings = ['STOCK_ADJUST|home|one'];
  const access = vi.fn(async () => ({ ...snapshot, permissionStrings }));
  const send = vi.fn(async () => accepted);
  stops.push(startStockEventUploader({ access, send }));
  onlineManager.setOnline(true);
  await waitFor(async () =>
    expect(await getLocalDb().table('stockEventQueue').get(event.sequence)).toMatchObject({
      pauseReason: 'access-changed',
    }),
  );
  expect(send).not.toHaveBeenCalled();
  permissionStrings = ['STOCK_ISSUE|home|one'];
  wakeStockEventSync();
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  await waitFor(async () => expect(await getLocalDb().table('stockEventReceipts').count()).toBe(1));
});

it('keeps foreground acceptance out of offline sync phases and summary toasts', async () => {
  const event = await enqueue();
  foregroundStockEvents.add(event.localEventId);
  const send = vi.fn(async () => {
    expect(getSyncPhase()).toBe('idle');
    return accepted;
  });
  try {
    stops.push(startStockEventUploader({ access: async () => snapshot, send }));
    onlineManager.setOnline(true);
    await waitFor(async () =>
      expect(await getLocalDb().table('stockEventReceipts').count()).toBe(1),
    );
    expect(getSyncPhase()).toBe('idle');
    expect(toast.success).not.toHaveBeenCalled();
  } finally {
    foregroundStockEvents.delete(event.localEventId);
  }
});

it('broadcasts acceptance and invalidates other-tab stock only for the current owner', async () => {
  const channels: {
    name: string;
    onmessage?: (message: { data: unknown }) => void;
    postMessage: ReturnType<typeof vi.fn>;
  }[] = [];
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      onmessage?: (message: { data: unknown }) => void;
      postMessage = vi.fn();
      close = vi.fn();
      constructor(public name: string) {
        channels.push(this);
      }
    },
  );
  const event = await enqueue();
  stops.push(startStockEventUploader({ access: async () => snapshot }));
  queryClient.setQueryData(queryKeys.stockCardSummaries.all, ['old-stock']);
  const listener = channels.find((channel) => channel.onmessage);
  expect(listener).toBeDefined();
  listener?.onmessage?.({
    data: { type: 'accepted', userId: 'someone-else', facilityId: 'home', programId: 'one' },
  });
  expect(queryClient.getQueryState(queryKeys.stockCardSummaries.all)?.isInvalidated).toBe(false);
  listener?.onmessage?.({
    data: { type: 'accepted', userId: event.userId, facilityId: 'home', programId: 'one' },
  });
  expect(queryClient.getQueryState(queryKeys.stockCardSummaries.all)?.isInvalidated).toBe(true);
  refreshAfterStockEventAccepted(queryClient, event);
  expect(
    channels.some((channel) =>
      channel.postMessage.mock.calls.some(
        ([data]) =>
          data.type === 'accepted' &&
          data.userId === event.userId &&
          typeof data.origin === 'string' &&
          Object.keys(data).sort().join(',') === 'origin,type,userId',
      ),
    ),
  ).toBe(true);
  const receive = listener?.onmessage;
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'other-uploader',
    username: 'Other',
    accessToken: 'other',
  });
  queryClient.setQueryData(queryKeys.stockCardSummaries.all, ['next-owner-stock']);
  receive?.({
    data: { type: 'accepted', userId: event.userId, facilityId: 'home', programId: 'one' },
  });
  expect(queryClient.getQueryState(queryKeys.stockCardSummaries.all)?.isInvalidated).toBe(false);
  queryClient.clear();
});

it('invalidates multiple receiving clients without requesting a download in each tab', async () => {
  const listeners: { onmessage?: (message: { data: unknown }) => void }[] = [];
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      onmessage?: (message: { data: unknown }) => void;
      constructor() {
        listeners.push(this);
      }
      postMessage() {}
      close() {}
    },
  );
  const clients = [new QueryClient(), new QueryClient()];
  const refresh = vi.fn();
  for (const other of clients) {
    other.setQueryData(queryKeys.stockCardSummaries.all, ['old']);
    stops.push(subscribeStockEventAcceptances(other));
  }
  const event = await enqueue();
  refreshAfterStockEventAccepted(queryClient, event, refresh);
  for (const listener of listeners)
    listener.onmessage?.({
      data: {
        type: 'accepted',
        origin: 'another-tab',
        userId: event.userId,
        facilityId: event.facilityId,
        programId: event.programId,
      },
    });
  expect(
    clients.every((other) => other.getQueryState(queryKeys.stockCardSummaries.all)?.isInvalidated),
  ).toBe(true);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('sends an abandoned foreground row as background without waiting for its old deadline', async () => {
  const event = await enqueue();
  await getLocalDb()
    .table('stockEventQueue')
    .update(event.sequence, { foregroundUntil: Date.now() + 65_000 });
  Object.assign(navigator.locks, { query: vi.fn(async () => ({ held: [], pending: [] })) });
  const phases: string[] = [];
  const send = vi.fn(async () => {
    phases.push(getSyncPhase());
    return accepted;
  });
  stops.push(startStockEventUploader({ access: async () => snapshot, send }));
  onlineManager.setOnline(true);
  await waitFor(async () => expect(await getLocalDb().table('stockEventReceipts').count()).toBe(1));
  await waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
  expect(getSyncPhase()).toBe('complete');
  expect(phases).toEqual(['syncing']);
});
