import type Dexie from 'dexie';
import type {
  InventoryLine,
  InventoryScope,
} from '@/features/stock-events/lib/physical-inventory-types';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { type DraftRevision, saveRevisionedDraft } from '@/lib/draft-store';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export type InventoryLocalCopy = InventoryScope & {
  draftId: string;
  revision?: number;
  lines: InventoryLine[];
  removedKeys?: string[];
  modified: boolean;
  savedAt: number;
};

export async function readInventoryLocal(draftId: string) {
  const scope = getSessionScope();
  const result = await getLocalDb()
    .table<InventoryLocalCopy>(LOCAL_TABLES.physicalInventoryDrafts)
    .get(draftId);
  assertSessionScope(scope);
  return result;
}

export async function writeInventoryLocal(
  copy: InventoryLocalCopy,
  scope = getSessionScope(),
  db: Dexie = getLocalDb(),
) {
  const table = db.table<InventoryLocalCopy, string>(LOCAL_TABLES.physicalInventoryDrafts);
  const expected = copy.revision ? copy : undefined;
  return saveRevisionedDraft({
    db,
    sessionScope: scope,
    table,
    expected,
    async read() {
      const stored = await table.get(copy.draftId);
      assertSessionScope(scope);
      if (stored && !stored.revision && !copy.revision) return undefined;
      return stored;
    },
    next: () => ({ ...copy, revision: (copy.revision ?? 0) + 1 }),
  });
}

export async function clearInventoryLocal(
  draftId: string,
  revision?: number,
  scope = getSessionScope(),
  db: Dexie = getLocalDb(),
) {
  assertSessionScope(scope);
  const table = db.table<DraftRevision, string>(LOCAL_TABLES.physicalInventoryDrafts);
  const expected = revision === undefined ? await table.get(draftId) : { draftId, revision };
  assertSessionScope(scope);
  await saveRevisionedDraft({
    db,
    sessionScope: scope,
    table,
    expected,
    read: async () => {
      const stored = await table.get(draftId);
      return !stored && revision === 0 ? expected : stored;
    },
    next: () => undefined,
  });
}
