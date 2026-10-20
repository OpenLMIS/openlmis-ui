import Dexie from 'dexie';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import {
  archiveStockEventCopy,
  createStockEventContext,
  deleteStockEventCopy,
  readArchivedStockEvents,
  readStockEventDraft,
  restoreStockEventCopy,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import { getLocalDb } from '@/integrations/local-db';
import { DraftConflictError } from '@/lib/draft-store';

const selection = { kind: 'adjustment' as const, facilityId: 'facility', programId: 'program' };
const line = newEventLine(
  {
    orderable: { id: 'product', productCode: 'MED', fullProductName: 'Medicine', netContent: 10 },
    lot: null,
    stockOnHand: 20,
  },
  undefined,
  '2026-10-14',
  { kind: 'adjustment', productHasLots: false },
);
line.quantity = { doses: '0012', packs: '01', remainder: '٠٢' };
beforeEach(async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'draft-user', username: 'user', accessToken: 'token' });
  await getLocalDb().table('stockEventDrafts').clear();
});
it('resumes exact typed values and snapshots and increments revisions', async () => {
  const context = createStockEventContext(selection);
  const first = await saveStockEventDraft(context, undefined, [line], 'download-generation');
  const second = await saveStockEventDraft(
    context,
    first,
    [{ ...line, reasonFreeText: 'test' }],
    'download-generation',
  );
  expect(second?.revision).toBe(2);
  expect(second?.draftId).toBe(first?.draftId);
  expect(await readStockEventDraft(context)).toEqual(second);
  expect(second?.lines[0].quantity).toEqual(line.quantity);
  expect(second?.downloadGeneration).toBe('download-generation');
});
it('enforces one editing draft and rejects stale autosave and discard', async () => {
  const context = createStockEventContext(selection);
  const first = await saveStockEventDraft(context, undefined, [line]);
  await expect(saveStockEventDraft(context, undefined, [line])).rejects.toBeInstanceOf(
    DraftConflictError,
  );
  const second = await saveStockEventDraft(context, first, [
    { ...line, reasonFreeText: 'other tab' },
  ]);
  await expect(saveStockEventDraft(context, first, [line])).rejects.toBeInstanceOf(
    DraftConflictError,
  );
  await expect(saveStockEventDraft(context, first, [])).rejects.toBeInstanceOf(DraftConflictError);
  expect(await readStockEventDraft(context)).toEqual(second);
  await saveStockEventDraft(context, second, []);
  expect(await readStockEventDraft(context)).toBeUndefined();
});
it('keeps current conflict edits in a separate archived copy without changing the active draft', async () => {
  const context = createStockEventContext(selection);
  const stored = await saveStockEventDraft(context, undefined, [line]);
  const copy = await archiveStockEventCopy(
    context,
    [{ ...line, reasonFreeText: 'my edits' }],
    'generation',
  );
  expect(copy.state).toBe('archived');
  expect(copy.draftId).not.toBe(stored?.draftId);
  expect(copy.lines[0].reasonFreeText).toBe('my edits');
  expect(await readStockEventDraft(context)).toEqual(stored);
});
it('rolls back a write when identity changes after put, and retains existing drafts on sign-out', async () => {
  const context = createStockEventContext(selection);
  const first = await saveStockEventDraft(context, undefined, [line]);
  const table = context.db.table('stockEventDrafts');
  const put = table.put.bind(table);
  vi.spyOn(table, 'put').mockImplementationOnce((...args) =>
    Dexie.Promise.resolve(
      (async () => {
        const result = await put(...args);
        useLoginData.getState().clearLoginData();
        return result;
      })(),
    ),
  );
  await expect(
    saveStockEventDraft(context, first, [{ ...line, reasonFreeText: 'obsolete' }]),
  ).rejects.toThrow();
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'draft-user', username: 'user', accessToken: 'new' });
  expect(await readStockEventDraft(createStockEventContext(selection))).toEqual(first);
});

it('restores an archived copy atomically, archives the active draft, and rejects stale restores and deletes', async () => {
  const context = createStockEventContext(selection);
  const current = await saveStockEventDraft(context, undefined, [line]);
  const copy = await archiveStockEventCopy(context, [{ ...line, reasonFreeText: 'archived' }]);
  const restored = await restoreStockEventCopy(context, current, copy);
  expect((await readStockEventDraft(context))?.lines[0].reasonFreeText).toBe('archived');
  const [archived] = await readArchivedStockEvents(context);
  expect(archived.draftId).toBe(current?.draftId);
  await expect(restoreStockEventCopy(context, current, archived)).rejects.toBeInstanceOf(
    DraftConflictError,
  );
  await expect(deleteStockEventCopy(context, copy)).rejects.toBeInstanceOf(DraftConflictError);
  await expect(
    deleteStockEventCopy({ ...context, facilityId: 'other' }, archived),
  ).rejects.toBeInstanceOf(DraftConflictError);
  expect(await readStockEventDraft(context)).toEqual(restored);
  await deleteStockEventCopy(context, archived);
  expect(await readArchivedStockEvents(context)).toEqual([]);
  expect(await readStockEventDraft(context)).toEqual(restored);
});
