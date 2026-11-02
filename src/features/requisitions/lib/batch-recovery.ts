import type { BatchLocalDraft } from '@/features/requisitions/hooks/use-batch-drafts';
import { batchLabel, matchesBaseline, orderBatch } from '@/features/requisitions/lib/batch';
import {
  readBatchSessionMarker,
  writeBatchSessionMarker,
} from '@/features/requisitions/lib/batch-session-markers';
import type { BatchResponse } from '@/features/requisitions/lib/batch-types';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { saveRevisionedDraft } from '@/lib/draft-store';
import { readOwnedRecord } from '@/lib/local-records';
import { isSecureOrigin } from '@/lib/secure-context';
import { assertSessionScope, getSessionScope, getSessionUserId } from '@/lib/session-scope';

export async function recoverBatchApprovals(ids: readonly string[], response: BatchResponse) {
  const removed = new Map<string, string>();
  if (!isSecureOrigin) {
    const userId = getSessionUserId();
    if (userId)
      for (const id of ids) {
        const marker = readBatchSessionMarker(userId, id);
        if (!marker) continue;
        const record = response.requisitionDtos?.find((r) => r.id === id);
        if (matchesBaseline(record, marker)) continue;
        writeBatchSessionMarker(userId, id);
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
    if (matchesBaseline(record, stored)) continue;
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
