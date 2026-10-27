import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as dexie from 'dexie';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  foregroundStockEvents,
  holdForegroundStockEvent,
  releaseForegroundStockEvent,
  useForegroundStockEventIds,
  waitForStockEventReceipt,
} from '@/features/stock-events/lib/stock-event-delivery';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { queryKeys } from '@/lib/key-factory';

vi.mock('dexie', async (original) => {
  const module = await original<typeof import('dexie')>();
  return { ...module, liveQuery: vi.fn(module.liveQuery) };
});

const event = {
  sequence: 1,
  localEventId: 'local',
  draftId: 'draft',
  revision: 1,
  userId: 'delivery',
  facilityId: 'home',
  programId: 'one',
  status: 'queued',
} as QueuedStockEvent;
afterEach(() => {
  for (const id of foregroundStockEvents) releaseForegroundStockEvent(id);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
beforeEach(async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'delivery', username: 'Ada', accessToken: 'token' });
  onlineManager.setOnline(true);
  for (const table of [
    LOCAL_TABLES.stockEventQueue,
    LOCAL_TABLES.stockEventSyncErrors,
    LOCAL_TABLES.stockEventReceipts,
  ])
    await getLocalDb().table(table).clear();
});
it('waits at most 65 seconds for a sending event even without a durable receipt', async () => {
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventQueue)
    .put({ ...event, status: 'sending' });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  let settled = false;
  const result = waitForStockEventReceipt(event).then((value) => {
    settled = true;
    return value;
  });
  await vi.advanceTimersByTimeAsync(64_999);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toEqual({ kind: 'uncertain' });
  expect((await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).status).toBe(
    'sending',
  );
});
it('checks durable sending state at the start deadline when live notifications lag', async () => {
  const queue = getLocalDb().table(LOCAL_TABLES.stockEventQueue);
  await queue.put(event);
  const unsubscribe = vi.fn();
  const delayed = dexie.liveQuery(async () => undefined);
  vi.spyOn(delayed, 'subscribe').mockReturnValue({ unsubscribe, closed: false });
  vi.mocked(dexie.liveQuery).mockReturnValueOnce(delayed);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  let settled = false;
  const result = waitForStockEventReceipt(event).then((value) => {
    settled = true;
    return value;
  });
  await vi.advanceTimersByTimeAsync(1499);
  await queue.update(event.sequence, { status: 'sending' });
  await vi.advanceTimersByTimeAsync(1);
  await vi.advanceTimersByTimeAsync(63_499);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toEqual({ kind: 'uncertain' });
  expect(unsubscribe).toHaveBeenCalledOnce();
});
it('reads a refusal after atomic queue removal instead of reporting queued', async () => {
  const error = {
    localEventId: event.localEventId,
    category: 'refused',
    message: 'Stock changed',
    event,
  };
  await getLocalDb().table(LOCAL_TABLES.stockEventSyncErrors).put(error);
  expect(await waitForStockEventReceipt(event)).toEqual({ kind: 'refused', error });
});
it('identifies an earlier uncertain event as a barrier to this queued event', async () => {
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventQueue)
    .bulkPut([
      { ...event, sequence: 1, localEventId: 'earlier', status: 'uncertain' },
      { ...event, sequence: 2 },
    ]);
  expect(await waitForStockEventReceipt({ ...event, sequence: 2 })).toEqual({ kind: 'blocked' });
});

for (const reason of ['access-changed', 'draft-changed'] as const)
  it(`reports its own ${reason} pause as held with the cause`, async () => {
    await getLocalDb()
      .table(LOCAL_TABLES.stockEventQueue)
      .put({ ...event, pauseReason: reason });
    expect(await waitForStockEventReceipt(event)).toEqual({ kind: 'held', reason });
  });

it('waits for its own access hold when an earlier event is access-paused', async () => {
  const queue = getLocalDb().table(LOCAL_TABLES.stockEventQueue);
  const next = { ...event, sequence: 2 };
  await queue.bulkPut([{ ...event, localEventId: 'earlier', pauseReason: 'access-changed' }, next]);
  const filter = vi.spyOn(queue, 'filter');
  const result = waitForStockEventReceipt(next);
  await waitFor(() => expect(filter).toHaveBeenCalled());
  await queue.update(next.sequence, { pauseReason: 'access-changed' });
  expect(await result).toEqual({ kind: 'held', reason: 'access-changed' });
});

it('keeps a slow online submission in progress and invalidates stock and lots before returning its receipt', async () => {
  const db = getLocalDb();
  await db.table(LOCAL_TABLES.stockEventQueue).put(event);
  const client = new QueryClient();
  client.setQueryData(queryKeys.stockCardSummaries.all, ['old-stock']);
  client.setQueryData(queryKeys.lots.all, ['old-lots']);
  await db.table(LOCAL_TABLES.stockEventQueue).update(event.sequence, { status: 'sending' });
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  const observed = vi.spyOn(db.table(LOCAL_TABLES.stockEventQueue), 'get');
  let settled = false;
  const result = waitForStockEventReceipt(event, client).then((value) => {
    settled = true;
    return value;
  });
  await waitFor(() => expect(observed).toHaveBeenCalled());
  await vi.advanceTimersByTimeAsync(1600);
  expect(settled).toBe(false);
  expect(client.getQueryState(queryKeys.stockCardSummaries.all)?.isInvalidated).toBe(false);
  expect(client.getQueryState(queryKeys.lots.all)?.isInvalidated).toBe(false);
  const receipt = {
    draftId: event.draftId,
    revision: event.revision,
    localEventId: event.localEventId,
    acceptedAt: Date.now(),
    source: 'server',
  };
  await db.table(LOCAL_TABLES.stockEventReceipts).put(receipt);
  await vi.advanceTimersByTimeAsync(0);
  expect(await result).toEqual({ kind: 'accepted', receipt });
  expect(client.getQueryState(queryKeys.stockCardSummaries.all)?.isInvalidated).toBe(true);
  expect(client.getQueryState(queryKeys.lots.all)?.isInvalidated).toBe(true);
});

it('returns queued after 1.5 seconds when the online uploader never starts', async () => {
  await getLocalDb().table(LOCAL_TABLES.stockEventQueue).put(event);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  let settled = false;
  const result = waitForStockEventReceipt(event).then((value) => {
    settled = true;
    return value;
  });
  await vi.advanceTimersByTimeAsync(1499);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toEqual({ kind: 'queued' });
  expect((await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).status).toBe(
    'queued',
  );
});

it('updates foreground counts when the waiting tab closes without waiting for a saved deadline', async () => {
  const name = `${getLocalDb().name}:fg:${event.localEventId}`;
  let held: { name: string }[] = [{ name }];
  vi.stubGlobal('navigator', { locks: { query: async () => ({ held, pending: [] }) } });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  const next = renderHook(() => useForegroundStockEventIds());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(next.result.current.has(event.localEventId)).toBe(true);
  held = [];
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(next.result.current.has(event.localEventId)).toBe(false);
  next.unmount();
});

it('holds foreground ownership until its delivery wait ends', async () => {
  let locked = false;
  const request = vi.fn(async (_name, _options, run) => {
    locked = true;
    try {
      await run({});
    } finally {
      locked = false;
    }
  });
  vi.stubGlobal('navigator', { locks: { request } });
  await holdForegroundStockEvent(event.localEventId);
  expect(locked).toBe(true);
  const error = { localEventId: event.localEventId, category: 'refused', event };
  await getLocalDb().table(LOCAL_TABLES.stockEventSyncErrors).put(error);
  expect(await waitForStockEventReceipt(event)).toEqual({ kind: 'refused', error });
  await waitFor(() => expect(locked).toBe(false));
  expect(foregroundStockEvents.has(event.localEventId)).toBe(false);
});
