import type Dexie from 'dexie';
import type {
  InventoryLine,
  InventoryScope,
} from '@/features/stock-events/lib/physical-inventory-types';
import { getLocalDb } from '@/integrations/local-db';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export type InventoryLocalCopy = InventoryScope & {
  draftId: string;
  lines: InventoryLine[];
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
  assertSessionScope(scope);
  const table = db.table<InventoryLocalCopy>('physicalInventoryDrafts');
  await db.transaction('rw', table, async () => {
    assertSessionScope(scope);
    await table.put(copy);
    assertSessionScope(scope);
  });
}

export async function clearInventoryLocal(draftId: string) {
  const scope = getSessionScope();
  const db = getLocalDb();
  await db.transaction('rw', 'physicalInventoryDrafts', async () => {
    assertSessionScope(scope);
    await db.table('physicalInventoryDrafts').delete(draftId);
    assertSessionScope(scope);
  });
}

export async function dropObsoleteInventoryCopies(scope: InventoryScope, draftId?: string) {
  const session = getSessionScope();
  const db = getLocalDb();
  await db.transaction('rw', 'physicalInventoryDrafts', async () => {
    assertSessionScope(session);
    await db
      .table<InventoryLocalCopy>('physicalInventoryDrafts')
      .filter(
        (copy) =>
          copy.programId === scope.programId &&
          copy.facilityId === scope.facilityId &&
          copy.draftId !== draftId,
      )
      .delete();
    assertSessionScope(session);
  });
}
