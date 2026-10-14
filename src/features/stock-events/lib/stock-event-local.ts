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
  state: 'editing' | 'archived';
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
  return context.db.transaction('rw', table, context.db.table('adjustmentDownloads'), async () => {
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
    };
    await table.put(next);
    assertSessionScope(context.sessionScope);
    return next;
  });
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
