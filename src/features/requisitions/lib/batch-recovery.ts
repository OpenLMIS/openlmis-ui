import type { BatchLocalDraft } from '@/features/requisitions/hooks/use-batch-drafts';
import { batchLabel, orderBatch } from '@/features/requisitions/lib/batch';
import type { BatchResponse } from '@/features/requisitions/lib/batch-types';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { saveRevisionedDraft } from '@/lib/draft-store';
import { readOwnedRecord } from '@/lib/local-records';
import { isSecureOrigin } from '@/lib/secure-context';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export async function recoverBatchApprovals(ids: readonly string[], response: BatchResponse) {
  const removed = new Map<string, string>();
  if (!isSecureOrigin) return { response: orderBatch(response, ids), removed };
  const scope = getSessionScope();
  const db = getLocalDb();
  const table = db.table<BatchLocalDraft, string>(LOCAL_TABLES.requisitionBatchDrafts);
  for (const id of ids) {
    const stored = await readOwnedRecord<BatchLocalDraft>(LOCAL_TABLES.requisitionBatchDrafts, id, {
      formats: [1],
    });
    assertSessionScope(scope);
    if (!stored?.unresolvedApproval) continue;
    const record = response.requisitionDtos?.find((r) => r.id === id);
    if (
      record &&
      record.status === stored.baselineStatus &&
      record.modifiedDate === stored.baselineModifiedDate
    )
      continue;
    await saveRevisionedDraft({
      db,
      table,
      sessionScope: scope,
      expected: stored,
      read: () => table.get(id),
      next: (current) =>
        current && Object.keys(current.approvedQuantities).length
          ? { ...current, revision: current.revision + 1, unresolvedApproval: undefined }
          : undefined,
    });
    assertSessionScope(scope);
    removed.set(id, record ? batchLabel(record) : id);
  }
  return {
    response: orderBatch(
      response,
      ids.filter((id) => !removed.has(id)),
    ),
    removed,
  };
}
