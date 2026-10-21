import Dexie from 'dexie';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { announceQueuedEvents } from '@/features/stock-events/lib/device-event-status';
import { eventPayload, newEventLine } from '@/features/stock-events/lib/event-form';
import { foregroundStockEvents } from '@/features/stock-events/lib/stock-event-delivery';
import {
  createStockEventContext,
  readStockEventDraft,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import { enqueueStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { DraftConflictError } from '@/lib/draft-store';

vi.mock('@/features/stock-events/lib/device-event-status', () => ({
  announceQueuedEvents: vi.fn(),
}));

const selection = { kind: 'adjustment' as const, facilityId: 'facility', programId: 'program' };
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
line.quantity.doses = '12';
const payload = () => eventPayload({ ...selection, lines: [line], signature: 'Ada' });
const display = {
  facility: { id: 'facility', code: 'FAC', name: 'Clinic' },
  program: { id: 'program', code: 'PROG', name: 'Medicines' },
};
beforeEach(async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'queue-user', username: 'Ada', accessToken: 'token' });
  await getLocalDb().table(LOCAL_TABLES.stockEventDrafts).clear();
  await getLocalDb().table(LOCAL_TABLES.stockEventQueue).clear();
});
it('rolls back both sides if the queue insert or draft freeze fails', async () => {
  const context = createStockEventContext(selection);
  const draft = await saveStockEventDraft(context, undefined, [line]);
  if (!draft) throw new Error('Missing draft');
  for (const [tableName, method] of [
    [LOCAL_TABLES.stockEventQueue, 'add'],
    [LOCAL_TABLES.stockEventDrafts, 'put'],
  ] as const) {
    vi.spyOn(context.db.table(tableName), method).mockRejectedValueOnce(new Error('quota'));
    await expect(enqueueStockEvent(context, draft, payload(), display)).rejects.toThrow('quota');
    expect(await readStockEventDraft(context)).toEqual(draft);
    expect(await context.db.table(LOCAL_TABLES.stockEventQueue).count()).toBe(0);
    expect(announceQueuedEvents).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  }
});
it('duplicate confirmation freezes one exact revision and body; queued work cannot be edited', async () => {
  const context = createStockEventContext(selection);
  const draft = await saveStockEventDraft(context, undefined, [line]);
  if (!draft) throw new Error('Missing draft');
  const body = payload();
  const [first, second] = await Promise.all([
    enqueueStockEvent(context, draft, body, display),
    enqueueStockEvent(context, draft, body, display),
  ]);
  expect(first.localEventId).toBe(second.localEventId);
  expect(announceQueuedEvents).toHaveBeenCalledExactlyOnceWith(1);
  expect(await context.db.table(LOCAL_TABLES.stockEventQueue).count()).toBe(1);
  expect(first.postBody).toBe(JSON.stringify(body));
  expect(first.payload).toEqual(body);
  expect(first.payload).not.toHaveProperty('documentNumber');
  body.signature = 'Mutated';
  expect(
    (await context.db.table(LOCAL_TABLES.stockEventQueue).get(first.sequence)).payload.signature,
  ).toBe('Ada');
  expect(await readStockEventDraft(context)).toBeUndefined();
  await expect(saveStockEventDraft(context, draft, [line])).rejects.toBeInstanceOf(
    DraftConflictError,
  );
  await expect(saveStockEventDraft(context, draft, [])).rejects.toBeInstanceOf(DraftConflictError);
  const next = await saveStockEventDraft(context, undefined, [line]);
  expect(next?.draftId).not.toBe(draft.draftId);
  expect((await context.db.table(LOCAL_TABLES.stockEventDrafts).get(draft.draftId)).state).toBe(
    'queued',
  );
});
it('detects a stale revision rather than freezing another tab edits', async () => {
  const context = createStockEventContext(selection);
  const draft = await saveStockEventDraft(context, undefined, [line]);
  if (!draft) throw new Error('Missing draft');
  const newer = await saveStockEventDraft(context, draft, [
    { ...line, reasonFreeText: 'other tab' },
  ]);
  await expect(enqueueStockEvent(context, draft, payload(), display)).rejects.toBeInstanceOf(
    DraftConflictError,
  );
  expect(await readStockEventDraft(context)).toEqual(newer);
  expect(await context.db.table(LOCAL_TABLES.stockEventQueue).count()).toBe(0);
});
it('rolls back enqueue after identity change and retains queued work on sign-out', async () => {
  const context = createStockEventContext(selection);
  const draft = await saveStockEventDraft(context, undefined, [line]);
  if (!draft) throw new Error('Missing draft');
  const table = context.db.table(LOCAL_TABLES.stockEventQueue);
  const add = table.add.bind(table);
  vi.spyOn(table, 'add').mockImplementationOnce((...args) =>
    Dexie.Promise.resolve(
      (async () => {
        const result = await add(...args);
        useLoginData.getState().clearLoginData();
        return result;
      })(),
    ),
  );
  await expect(enqueueStockEvent(context, draft, payload(), display)).rejects.toThrow();
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'queue-user', username: 'Ada', accessToken: 'new' });
  const fresh = createStockEventContext(selection);
  expect(await readStockEventDraft(fresh)).toEqual(draft);
  expect(await fresh.db.table(LOCAL_TABLES.stockEventQueue).count()).toBe(0);
  await expect(enqueueStockEvent(context, draft, payload(), display)).rejects.toThrow();
  const queued = await enqueueStockEvent(fresh, draft, payload(), display);
  useLoginData.getState().clearLoginData();
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'queue-user', username: 'Ada', accessToken: 'again' });
  expect(await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(queued.sequence)).toEqual(
    queued,
  );
});

it('announces only waiting work when earlier events have their own pause notice', async () => {
  const context = createStockEventContext(selection);
  const draft = await saveStockEventDraft(context, undefined, [line]);
  if (!draft) throw new Error('Missing draft');
  const first = await enqueueStockEvent(context, draft, payload(), display);
  await context.db
    .table(LOCAL_TABLES.stockEventQueue)
    .update(first.sequence, { pauseReason: 'access-changed' });
  vi.mocked(announceQueuedEvents).mockClear();
  const next = await saveStockEventDraft(context, undefined, [line]);
  if (!next) throw new Error('Missing draft');
  await enqueueStockEvent(context, next, payload(), display);
  expect(announceQueuedEvents).toHaveBeenCalledExactlyOnceWith(1);
});

it('registers foreground delivery before publishing the queue and skips its offline announcement', async () => {
  const context = createStockEventContext(selection);
  const draft = await saveStockEventDraft(context, undefined, [line]);
  if (!draft) throw new Error('Missing draft');
  const queued = await enqueueStockEvent(context, draft, payload(), display, { foreground: true });
  expect(foregroundStockEvents.has(queued.localEventId)).toBe(true);
  expect(queued).not.toHaveProperty('foregroundUntil');
  expect(announceQueuedEvents).not.toHaveBeenCalled();
  foregroundStockEvents.clear();
});

it('releases foreground ownership when the session changes after the transaction commits', async () => {
  const context = createStockEventContext(selection);
  const draft = await saveStockEventDraft(context, undefined, [line]);
  if (!draft) throw new Error('Missing draft');
  let released = false;
  vi.stubGlobal('navigator', {
    locks: {
      request: async (_name: string, _options: unknown, run: (lock: object) => Promise<void>) => {
        await run({});
        released = true;
      },
    },
  });
  const transaction = context.db.transaction.bind(context.db);
  vi.spyOn(context.db, 'transaction').mockImplementationOnce((...args) =>
    transaction(...args).then((result) => {
      useLoginData.getState().clearLoginData();
      return result;
    }),
  );
  try {
    await expect(
      enqueueStockEvent(context, draft, payload(), display, { foreground: true }),
    ).rejects.toThrow();
    expect(foregroundStockEvents.has(draft.localEventId)).toBe(false);
    await Promise.resolve();
    expect(released).toBe(true);
  } finally {
    const { releaseForegroundStockEvent } = await import(
      '@/features/stock-events/lib/stock-event-delivery'
    );
    releaseForegroundStockEvent(draft.localEventId);
    vi.unstubAllGlobals();
  }
});
