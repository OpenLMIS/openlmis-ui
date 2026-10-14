import { onlineManager } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startStockEventUploader } from '@/components/stock-event-uploader';
import { useLoginData } from '@/features/auth/store/login-data';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import {
  createStockEventContext,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import { enqueueStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import { getLocalDb } from '@/integrations/local-db';
import type { OfflineAccess } from '@/lib/offline-access';

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
  stops.push(startStockEventUploader({ access, send }));
  onlineManager.setOnline(true);
  expect(access).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
it('revoked fresh grants keep a local refusal without dispatch', async () => {
  const event = await enqueue();
  const send = vi.fn();
  stops.push(
    startStockEventUploader({ access: async () => ({ ...snapshot, permissionStrings: [] }), send }),
  );
  onlineManager.setOnline(true);
  await waitFor(async () =>
    expect(await getLocalDb().table('stockEventSyncErrors').count()).toBe(1),
  );
  expect(send).not.toHaveBeenCalled();
  expect(
    (await getLocalDb().table('stockEventSyncErrors').get(event.localEventId)).event.postBody,
  ).toBe(event.postBody);
});
