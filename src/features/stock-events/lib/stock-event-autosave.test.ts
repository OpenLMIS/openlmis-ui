import Dexie from 'dexie';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import { createStockEventWriter } from '@/features/stock-events/lib/stock-event-autosave';
import {
  createStockEventContext,
  readStockEventDraft,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import { getLocalDb } from '@/integrations/local-db';

const selection = { kind: 'adjustment' as const, facilityId: 'facility', programId: 'program' };
const line = newEventLine(
  {
    orderable: { id: 'p', productCode: 'P', fullProductName: 'Product', netContent: 10 },
    lot: null,
    stockOnHand: 20,
  },
  undefined,
  '2026-10-14',
  { kind: 'adjustment', productHasLots: false },
);
beforeEach(async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'writer-user', username: 'user', accessToken: 'token' });
  await getLocalDb().table('stockEventDrafts').clear();
});
it('serializes edits during a commit, coalesces them, and advances the expected revision', async () => {
  const context = createStockEventContext(selection);
  const status = vi.fn();
  const table = context.db.table('stockEventDrafts');
  const put = table.put.bind(table);
  let edit!: () => void;
  vi.spyOn(table, 'put').mockImplementationOnce((...args) =>
    Dexie.Promise.resolve(
      (async () => {
        edit();
        return put(...args);
      })(),
    ),
  );
  const writer = createStockEventWriter(context, undefined, status);
  edit = () => {
    writer.enqueue([{ ...line, reasonFreeText: 'second' }]);
    writer.enqueue([{ ...line, reasonFreeText: 'latest' }]);
  };
  writer.enqueue([line]);
  await writer.flush();
  const saved = await readStockEventDraft(context);
  expect(saved?.revision).toBe(2);
  expect(saved?.lines[0].reasonFreeText).toBe('latest');
  expect(status.mock.calls.map(([state]) => state.status)).toEqual([
    'saving',
    'saving',
    'saving',
    'saved',
  ]);
});
it('never reports saved after a failed transaction and Retry commits retained edits', async () => {
  const context = createStockEventContext(selection);
  const status = vi.fn();
  vi.spyOn(context.db.table('stockEventDrafts'), 'put').mockRejectedValueOnce(new Error('quota'));
  const writer = createStockEventWriter(context, undefined, status);
  writer.enqueue([line]);
  await writer.flush();
  expect(status.mock.calls.map(([state]) => state.status)).toEqual(['saving', 'failed']);
  expect(await readStockEventDraft(context)).toBeUndefined();
  writer.retry();
  await writer.flush();
  expect(status.mock.lastCall?.[0].status).toBe('saved');
  expect((await readStockEventDraft(context))?.revision).toBe(1);
});
it('stops on conflict, loads stored edits on request, or archives current edits before loading', async () => {
  const context = createStockEventContext(selection);
  const original = await saveStockEventDraft(context, undefined, [line]);
  const status = vi.fn();
  const writer = createStockEventWriter(context, original, status);
  await saveStockEventDraft(context, original, [{ ...line, reasonFreeText: 'other tab' }]);
  writer.enqueue([{ ...line, reasonFreeText: 'my unsaved edits' }]);
  await writer.flush();
  expect(status.mock.lastCall?.[0].status).toBe('conflict');
  writer.enqueue([{ ...line, reasonFreeText: 'latest unsaved edits' }]);
  await writer.flush();
  expect((await readStockEventDraft(context))?.lines[0].reasonFreeText).toBe('other tab');
  const loaded = await writer.resolve('copy');
  expect(loaded?.lines[0].reasonFreeText).toBe('other tab');
  const archived = await context.db
    .table('stockEventDrafts')
    .filter((draft) => draft.state === 'archived')
    .toArray();
  expect(archived[0].lines[0].reasonFreeText).toBe('latest unsaved edits');
  await saveStockEventDraft(context, loaded, [{ ...line, reasonFreeText: 'third tab' }]);
  writer.enqueue([line]);
  await writer.flush();
  expect((await writer.resolve('load'))?.lines[0].reasonFreeText).toBe('third tab');
  expect(await context.db.table('stockEventDrafts').count()).toBe(2);
});

it('stale confirmed Clear preserves current lines for the conflict copy choice', async () => {
  const context = createStockEventContext(selection);
  const original = await saveStockEventDraft(context, undefined, [line]);
  const writer = createStockEventWriter(context, original, vi.fn());
  await saveStockEventDraft(context, original, [{ ...line, reasonFreeText: 'other tab' }]);
  expect(await writer.replace([])).toBe(false);
  await writer.resolve('copy');
  const archived = await context.db
    .table('stockEventDrafts')
    .filter((draft) => draft.state === 'archived')
    .first();
  expect(archived.lines).toEqual([line]);
  expect((await readStockEventDraft(context))?.lines[0].reasonFreeText).toBe('other tab');
});

it('rejects stale navigation Discard and leaves the stored and current edits available', async () => {
  const context = createStockEventContext(selection);
  const original = await saveStockEventDraft(context, undefined, [line]);
  const status = vi.fn();
  const writer = createStockEventWriter(context, original, status);
  await saveStockEventDraft(context, original, [{ ...line, reasonFreeText: 'other tab' }]);
  writer.stage([{ ...line, reasonFreeText: 'my edits' }]);
  expect(await writer.discard()).toBe(false);
  expect(status.mock.lastCall?.[0].status).toBe('conflict');
  await writer.resolve('copy');
  const archived = await context.db
    .table('stockEventDrafts')
    .filter((draft) => draft.state === 'archived')
    .first();
  expect(archived.lines[0].reasonFreeText).toBe('my edits');
  expect((await readStockEventDraft(context))?.lines[0].reasonFreeText).toBe('other tab');
});

it('Retry after a failed confirmed Clear saves the lines still displayed by the editor', async () => {
  const context = createStockEventContext(selection);
  const original = await saveStockEventDraft(context, undefined, [line]);
  const status = vi.fn();
  const writer = createStockEventWriter(context, original, status);
  vi.spyOn(context.db.table('stockEventDrafts'), 'delete').mockRejectedValueOnce(
    new Error('quota'),
  );
  expect(await writer.replace([])).toBe(false);
  writer.retry();
  await writer.flush();
  expect(status.mock.lastCall?.[0].status).toBe('saved');
  expect((await readStockEventDraft(context))?.lines).toEqual([line]);
});
