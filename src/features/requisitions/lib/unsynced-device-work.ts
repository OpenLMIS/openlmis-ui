import type { BatchLocalDraft } from '@/features/requisitions/hooks/use-batch-drafts';
import type { RequisitionLocalDraft } from '@/features/requisitions/hooks/use-requisition-draft';
import { getLocalDb, getLocalDbUserId, LOCAL_TABLES } from '@/integrations/local-db';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export function hasUnsyncedRequisitionDraft({ draft, baseHeaders }: RequisitionLocalDraft) {
  return (
    Object.values(draft.lines).some((changes) => Object.keys(changes).length > 0) ||
    Object.keys(draft.patients ?? {}).length > 0 ||
    draft.addedLines.length > 0 ||
    draft.removedLineIds.length > 0 ||
    draft.draftStatusMessage !== (baseHeaders?.draftStatusMessage ?? '') ||
    draft.datePhysicalStockCountCompleted !== (baseHeaders?.datePhysicalStockCountCompleted ?? null)
  );
}

async function countOwnedRows<T extends { userId: string }>(
  table: string,
  unsynced: (row: T) => unknown,
) {
  let userId: string;
  try {
    userId = getLocalDbUserId();
  } catch {
    return 0;
  }
  const scope = getSessionScope();
  const rows = await getLocalDb().table<T>(table).toArray();
  assertSessionScope(scope);
  return rows.filter((row) => row.userId === userId && unsynced(row)).length;
}
export function countUnsyncedRequisitionDrafts() {
  return countOwnedRows<RequisitionLocalDraft>(
    LOCAL_TABLES.requisitionDrafts,
    hasUnsyncedRequisitionDraft,
  );
}
export function countUnsyncedBatchDrafts() {
  return countOwnedRows<BatchLocalDraft>(
    LOCAL_TABLES.requisitionBatchDrafts,
    (row) =>
      row.formatVersion === 1 &&
      (Object.keys(row.approvedQuantities).length > 0 || row.unresolvedApproval),
  );
}
