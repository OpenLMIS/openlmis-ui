import { onlineManager } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import Dexie from 'dexie';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import {
  createStockEventContext,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import { enqueueStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import { client } from '@/integrations/axios';
import { getLocalDb } from '@/integrations/local-db';
import { getSyncPhase, useSyncPhase, wakeStockEventSync } from '@/lib/device-event-status';
import type { OfflineAccess } from '@/lib/offline-access';
import { startStockEventUploader } from '@/lib/stock-event-uploader';

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
async function enqueue() {
  const context = createStockEventContext({
    kind: 'adjustment',
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
