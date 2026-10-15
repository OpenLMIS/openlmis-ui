import { onlineManager } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { waitForStockEventReceipt } from '@/features/stock-events/lib/stock-event-delivery';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import { getLocalDb } from '@/integrations/local-db';

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
beforeEach(async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'delivery', username: 'Ada', accessToken: 'token' });
  onlineManager.setOnline(true);
  for (const table of ['stockEventQueue', 'stockEventSyncErrors', 'stockEventReceipts'])
    await getLocalDb().table(table).clear();
});
it('waits at most 65 seconds for a sending event even without a durable receipt', async () => {
  await getLocalDb()
    .table('stockEventQueue')
    .put({ ...event, status: 'sending' });
  const original = globalThis.setTimeout;
  let deadline!: () => void;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation((handler, timeout, ...args) => {
    const handle = original(handler, timeout, ...args);
    if (timeout === 1500) startTimer = handle;
    if (timeout === 65_000)
      deadline = () => {
        if (typeof handler === 'function') handler(...args);
      };
    return handle;
  });
  const cleared = vi.spyOn(globalThis, 'clearTimeout');
  const result = waitForStockEventReceipt(event);
  await waitFor(() => expect(cleared).toHaveBeenCalledWith(startTimer));
  deadline();
  expect(await result).toEqual({ kind: 'uncertain' });
  expect((await getLocalDb().table('stockEventQueue').get(event.sequence)).status).toBe('sending');
});
it('reads a refusal after atomic queue removal instead of reporting queued', async () => {
  const error = {
    localEventId: event.localEventId,
    category: 'refused',
    message: 'Stock changed',
    event,
  };
  await getLocalDb().table('stockEventSyncErrors').put(error);
  expect(await waitForStockEventReceipt(event)).toEqual({ kind: 'refused', error });
});
it('identifies an earlier uncertain event as a barrier to this queued event', async () => {
  await getLocalDb()
    .table('stockEventQueue')
    .bulkPut([
      { ...event, sequence: 1, localEventId: 'earlier', status: 'uncertain' },
      { ...event, sequence: 2 },
    ]);
  expect(await waitForStockEventReceipt({ ...event, sequence: 2 })).toEqual({ kind: 'blocked' });
});

for (const reason of ['access-changed', 'draft-changed'] as const)
  it(`reports its own ${reason} pause as held with the cause`, async () => {
    await getLocalDb()
      .table('stockEventQueue')
      .put({ ...event, pauseReason: reason });
    expect(await waitForStockEventReceipt(event)).toEqual({ kind: 'held', reason });
  });
