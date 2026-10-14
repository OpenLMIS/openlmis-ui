import type Dexie from 'dexie';
import type { EventLine } from '@/features/stock-events/lib/event-form';
import type { ConfiguredEventKind } from '@/features/stock-events/lib/event-kinds';
import { getLocalDb, getLocalDbUserId } from '@/integrations/local-db';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export type StockEventSelection = {
  kind: ConfiguredEventKind;
  facilityId: string;
  programId: string;
};
export type StockEventDraft = StockEventSelection & {
  userId: string;
  draftId: string;
  revision: number;
  state: 'editing' | 'archived' | 'queued' | 'refused' | 'uncertain' | 'accepted';
  localEventId: string;
  signature?: string;
  lines: EventLine[];
  savedAt: number;
  updatedAt: number;
  downloadGeneration?: string;
};
export type StockEventContext = StockEventSelection & {
  userId: string;
  sessionScope: number;
  db: Dexie;
};
export function createStockEventContext(selection: StockEventSelection): StockEventContext {
  return {
    ...selection,
    userId: getLocalDbUserId(),
    sessionScope: getSessionScope(),
    db: getLocalDb(),
  };
}
export class DraftConflictError extends Error {
  constructor(public stored: StockEventDraft | undefined) {
    super('This draft was edited in another tab');
  }
}
const editingKey = (context: StockEventSelection) => [
  context.kind,
  context.facilityId,
  context.programId,
  'editing',
];
export async function readStockEventDraft(context: StockEventContext) {
  assertSessionScope(context.sessionScope);
  const result = await context.db
    .table<StockEventDraft>('stockEventDrafts')
    .where('[kind+facilityId+programId+state]')
    .equals(editingKey(context))
    .first();
  assertSessionScope(context.sessionScope);
  return result;
}
function record(
  context: StockEventContext,
  lines: EventLine[],
  downloadGeneration?: string,
): StockEventDraft {
  return {
    kind: context.kind,
    facilityId: context.facilityId,
    programId: context.programId,
    userId: context.userId,
    draftId: crypto.randomUUID(),
    revision: 1,
    localEventId: crypto.randomUUID(),
    state: 'editing',
    lines,
    savedAt: Date.now(),
    updatedAt: Date.now(),
    downloadGeneration,
  };
}
export async function saveStockEventDraft(
  context: StockEventContext,
  expected: StockEventDraft | undefined,
  lines: EventLine[],
  downloadGeneration?: string,
): Promise<StockEventDraft | undefined> {
  assertSessionScope(context.sessionScope);
  const table = context.db.table<StockEventDraft>('stockEventDrafts');
  const saved = await context.db.transaction(
    'rw',
    table,
    context.db.table('adjustmentDownloads'),
    async () => {
      const stored = await readStockEventDraft(context);
      if (stored?.draftId !== expected?.draftId || stored?.revision !== expected?.revision)
        throw new DraftConflictError(stored);
      if (!lines.length) {
        if (stored) {
          await table.delete(stored.draftId);
          assertSessionScope(context.sessionScope);
        }
        return undefined;
      }
      const bundle = await context.db
        .table('adjustmentDownloads')
        .get([context.facilityId, context.programId]);
      assertSessionScope(context.sessionScope);
      const next: StockEventDraft = {
        ...record(
          context,
          lines,
          stored?.downloadGeneration ?? downloadGeneration ?? bundle?.generation,
        ),
        draftId: stored?.draftId ?? crypto.randomUUID(),
        revision: (stored?.revision ?? 0) + 1,
        localEventId: stored?.localEventId ?? crypto.randomUUID(),
      };
      await table.put(next);
      assertSessionScope(context.sessionScope);
      return next;
    },
  );
  assertSessionScope(context.sessionScope);
  return saved;
}
export async function archiveStockEventCopy(
  context: StockEventContext,
  lines: EventLine[],
  downloadGeneration?: string,
) {
  assertSessionScope(context.sessionScope);
  const table = context.db.table<StockEventDraft>('stockEventDrafts');
  return context.db.transaction('rw', table, async () => {
    assertSessionScope(context.sessionScope);
    const copy = { ...record(context, lines, downloadGeneration), state: 'archived' as const };
    await table.add(copy);
    assertSessionScope(context.sessionScope);
    return copy;
  });
}

export async function readArchivedStockEvents(context: StockEventContext) {
  assertSessionScope(context.sessionScope);
  const copies = await context.db
    .table<StockEventDraft>('stockEventDrafts')
    .where('[kind+facilityId+programId+state]')
    .equals([context.kind, context.facilityId, context.programId, 'archived'])
    .toArray();
  assertSessionScope(context.sessionScope);
  return copies.sort((a, b) => b.savedAt - a.savedAt);
}

async function checkedCopy(context: StockEventContext, copy: StockEventDraft) {
  const stored = await context.db.table<StockEventDraft>('stockEventDrafts').get(copy.draftId);
  assertSessionScope(context.sessionScope);
  if (
    !stored ||
    stored.revision !== copy.revision ||
    stored.state !== 'archived' ||
    stored.kind !== context.kind ||
    stored.facilityId !== context.facilityId ||
    stored.programId !== context.programId
  )
    throw new DraftConflictError(stored);
  return stored;
}

export async function restoreStockEventCopy(
  context: StockEventContext,
  expected: StockEventDraft | undefined,
  copy: StockEventDraft,
) {
  const table = context.db.table<StockEventDraft>('stockEventDrafts');
  return context.db.transaction('rw', table, async () => {
    const stored = await readStockEventDraft(context);
    if (stored?.draftId !== expected?.draftId || stored?.revision !== expected?.revision)
      throw new DraftConflictError(stored);
    const archived = await checkedCopy(context, copy);
    if (stored) await table.put({ ...stored, state: 'archived', revision: stored.revision + 1 });
    const restored: StockEventDraft = {
      ...archived,
      state: 'editing',
      revision: archived.revision + 1,
      updatedAt: Date.now(),
    };
    await table.put(restored);
    assertSessionScope(context.sessionScope);
    return restored;
  });
}

export async function deleteStockEventCopy(context: StockEventContext, copy: StockEventDraft) {
  const table = context.db.table<StockEventDraft>('stockEventDrafts');
  await context.db.transaction('rw', table, async () => {
    await checkedCopy(context, copy);
    await table.delete(copy.draftId);
    assertSessionScope(context.sessionScope);
  });
}
