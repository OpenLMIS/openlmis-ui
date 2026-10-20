import type Dexie from 'dexie';
import type {
  InventoryLine,
  InventoryScope,
} from '@/features/stock-events/lib/physical-inventory-types';
import { getLocalDb } from '@/integrations/local-db';
import { assertDraftRevision, type DraftRevision, saveRevisionedDraft } from '@/lib/draft-store';
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
    .table<InventoryLocalCopy>('physicalInventoryDrafts')
    .get(draftId);
  assertSessionScope(scope);
  return result;
}

export async function writeInventoryLocal(
  copy: InventoryLocalCopy,
  scope = getSessionScope(),
  db: Dexie = getLocalDb(),
) {
  const table = db.table<InventoryLocalCopy, string>('physicalInventoryDrafts');
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
  await db.transaction('rw', 'physicalInventoryDrafts', async () => {
    assertSessionScope(scope);
    const table = db.table<InventoryLocalCopy>('physicalInventoryDrafts');
    if (revision !== undefined) {
      const stored = await table.get(draftId);
      assertSessionScope(scope);
      assertDraftRevision<DraftRevision>(
        stored,
        !stored && revision === 0 ? undefined : { draftId, revision },
      );
    }
    await table.delete(draftId);
    assertSessionScope(scope);
  });
}
