import type Dexie from 'dexie';
import type { Reason } from '@/features/reference-data/lib/types';
import type {
  InventoryLine,
  InventoryScope,
  InventoryStockLine,
} from '@/features/stock-events/lib/physical-inventory-types';
import { getLocalDb, getLocalDbUserId, LOCAL_TABLES } from '@/integrations/local-db';
import { DraftConflictError, type DraftRevision, saveRevisionedDraft } from '@/lib/draft-store';
import type { DeviceSnapshot } from '@/lib/local-data';
import { putOwnedRecord, readOwnedRecord } from '@/lib/local-records';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export type InventoryLocalCopy = InventoryScope &
  Partial<DeviceSnapshot> & {
    draftId: string;
    formatVersion?: number;
    baselineKeys?: string[];
    orphaned?: boolean;
    revision?: number;
    lines: InventoryLine[];
    removedKeys?: string[];
    modified: boolean;
    savedAt: number;
  };

export const INVENTORY_FORMAT_VERSION = 1;
export type InventoryReference = InventoryScope &
  DeviceSnapshot & {
    userId: string;
    formatVersion: number;
    draftId: string;
    eligible: InventoryStockLine[];
    reasons: Pick<Reason, 'id' | 'name' | 'reasonType'>[];
  };

export function inventoryReference(
  copy: InventoryLocalCopy & DeviceSnapshot,
  eligible: readonly InventoryStockLine[],
  reasons: readonly Pick<Reason, 'id' | 'name' | 'reasonType'>[],
): InventoryReference {
  return {
    userId: getLocalDbUserId(),
    formatVersion: INVENTORY_FORMAT_VERSION,
    draftId: copy.draftId,
    facilityId: copy.facilityId,
    programId: copy.programId,
    fetchedAt: copy.fetchedAt,
    generation: copy.generation,
    eligible: eligible.map(({ orderable: p, lot, stockOnHand, stockCardId, active }) => ({
      orderable: {
        id: p.id,
        productCode: p.productCode,
        fullProductName: p.fullProductName,
        description: null,
        dispensable: { displayUnit: p.dispensable?.displayUnit },
        netContent: p.netContent,
        identifiers: p.identifiers?.tradeItem ? { tradeItem: p.identifiers.tradeItem } : undefined,
        extraData: { useVVM: p.extraData?.useVVM },
        programs: p.programs?.map(({ programId, orderableCategoryDisplayName }) => ({
          programId,
          orderableCategoryDisplayName,
        })),
      },
      lot: lot
        ? {
            id: lot.id,
            lotCode: lot.lotCode,
            expirationDate: lot.expirationDate,
            tradeItemId: lot.tradeItemId,
          }
        : null,
      stockOnHand,
      stockCardId,
      active,
    })),
    reasons: reasons.map(({ id, name, reasonType }) => ({ id, name, reasonType })),
  };
}

export async function readInventoryScope(scope: InventoryScope) {
  const session = getSessionScope();
  const copies = await getLocalDb()
    .table<InventoryLocalCopy>(LOCAL_TABLES.physicalInventoryDrafts)
    .where('[facilityId+programId]')
    .equals([scope.facilityId, scope.programId])
    .toArray();
  assertSessionScope(session);
  return copies;
}

export async function readInventoryLocalByScope(scope: InventoryScope) {
  return (await readInventoryScope(scope))
    .filter(
      (copy) =>
        copy.formatVersion === INVENTORY_FORMAT_VERSION &&
        !copy.orphaned &&
        copy.baselineKeys !== undefined &&
        copy.fetchedAt !== undefined &&
        !!copy.generation,
    )
    .sort((a, b) => (b.fetchedAt ?? 0) - (a.fetchedAt ?? 0))[0];
}

export function readInventoryReference(copy: InventoryLocalCopy) {
  return readOwnedRecord<InventoryReference>(
    LOCAL_TABLES.physicalInventoryReference,
    copy.draftId,
    {
      formats: [INVENTORY_FORMAT_VERSION],
      accept: (ref) =>
        copy.formatVersion === INVENTORY_FORMAT_VERSION &&
        !!copy.generation &&
        ref.draftId === copy.draftId &&
        ref.facilityId === copy.facilityId &&
        ref.programId === copy.programId &&
        ref.generation === copy.generation &&
        ref.fetchedAt === copy.fetchedAt,
    },
  );
}

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
  reference?: InventoryReference,
) {
  const table = db.table<InventoryLocalCopy, string>(LOCAL_TABLES.physicalInventoryDrafts);
  const expected = copy.revision ? copy : undefined;
  return saveRevisionedDraft({
    db,
    sessionScope: scope,
    table,
    tables: [LOCAL_TABLES.physicalInventoryReference],
    expected,
    async read() {
      const stored = await table.get(copy.draftId);
      assertSessionScope(scope);
      if (stored?.orphaned && !copy.orphaned) throw new DraftConflictError(stored);
      if (stored && !stored.revision && !copy.revision) return undefined;
      return stored;
    },
    next: async () => {
      if (reference) {
        if (
          reference.draftId !== copy.draftId ||
          reference.facilityId !== copy.facilityId ||
          reference.programId !== copy.programId ||
          reference.generation !== copy.generation ||
          reference.fetchedAt !== copy.fetchedAt
        )
          throw new Error('Mismatched inventory reference');
        await putOwnedRecord(LOCAL_TABLES.physicalInventoryReference, reference, () =>
          assertSessionScope(scope),
        );
      }
      return { ...copy, revision: (copy.revision ?? 0) + 1 };
    },
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
    tables: [LOCAL_TABLES.physicalInventoryReference],
    expected,
    read: async () => {
      const stored = await table.get(draftId);
      return !stored && revision === 0 ? expected : stored;
    },
    next: async () => {
      await db.table(LOCAL_TABLES.physicalInventoryReference).delete(draftId);
      return undefined;
    },
  });
}

export async function reconcileInventoryCopies(scope: InventoryScope, serverId?: string) {
  const session = getSessionScope();
  const db = getLocalDb();
  const copies = await readInventoryScope(scope);
  for (const copy of copies) {
    if (copy.draftId === serverId || copy.orphaned) continue;
    if (!copy.modified) await clearInventoryLocal(copy.draftId, copy.revision ?? 0, session, db);
    else await writeInventoryLocal({ ...copy, orphaned: true }, session, db);
  }
}
