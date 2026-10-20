import type Dexie from 'dexie';
import type { Table } from 'dexie';
import { assertSessionScope } from '@/lib/session-scope';

export type DraftRevision = { draftId: string; revision?: number };
export class DraftConflictError<T extends DraftRevision = DraftRevision> extends Error {
  constructor(public stored: T | undefined) {
    super('This draft was edited in another tab');
  }
}
export function assertDraftRevision<T extends DraftRevision>(
  stored: T | undefined,
  expected: T | undefined,
) {
  if (
    stored?.draftId !== expected?.draftId ||
    (stored?.revision ?? 0) !== (expected?.revision ?? 0)
  )
    throw new DraftConflictError(stored);
}
export async function saveRevisionedDraft<T extends DraftRevision>(options: {
  db: Dexie;
  sessionScope: number;
  table: Table<T, string>;
  tables?: string[];
  expected: T | undefined;
  read: () => Promise<T | undefined>;
  next: (stored: T | undefined) => Promise<T | undefined> | T | undefined;
}) {
  const { db, sessionScope, table, expected, read, next } = options;
  assertSessionScope(sessionScope);
  const saved = await db.transaction('rw', [table, ...(options.tables ?? [])], async () => {
    assertSessionScope(sessionScope);
    const stored = await read();
    assertSessionScope(sessionScope);
    assertDraftRevision(stored, expected);
    const value = await next(stored);
    assertSessionScope(sessionScope);
    if (value) await table.put(value);
    else if (stored) await table.delete(stored.draftId);
    assertSessionScope(sessionScope);
    return value;
  });
  assertSessionScope(sessionScope);
  return saved;
}
