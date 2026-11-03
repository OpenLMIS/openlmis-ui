import { fetchApprovalList } from '@/features/requisitions/api/api';
import type { BatchResponse } from '@/features/requisitions/lib/batch-types';
import {
  mayApproveCopy,
  mayApproveSavedCopy,
  nodesWithRight,
  readRequisitionAccess,
  waitForRequisitionAccess,
} from '@/features/requisitions/lib/offline-access';
import {
  attachCopyLease,
  type CopyLease,
  type CopySummary,
  commitCopy,
  readCopy,
} from '@/features/requisitions/lib/offline-copies';
import type { SingleReferences } from '@/features/requisitions/lib/offline-single';
import type { ApprovalListRow } from '@/features/requisitions/lib/types';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { RIGHTS } from '@/lib/rights';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

async function findBatchSummaries(ids: readonly string[], session: number) {
  const remaining = new Set(ids);
  const found: ApprovalListRow[] = [];
  for (let page = 0; remaining.size; page++) {
    assertSessionScope(session);
    const result = await fetchApprovalList({ page, size: 100, sort: ['id,asc'] });
    assertSessionScope(session);
    for (const row of result.content) if (remaining.delete(row.id)) found.push(row);
    if (page + 1 >= result.totalPages) break;
  }
  if (remaining.size) throw new LocalDataUnavailableError();
  return found;
}
export async function captureBatch(
  leases: CopyLease[],
  response: BatchResponse,
  currency: SingleReferences['currency'],
  summaries: readonly ApprovalListRow[] = [],
  accessMode: 'wait' | 'read' = 'wait',
) {
  const records = response.requisitionDtos ?? [];
  const missing = records
    .filter(
      (record) =>
        !summaries.some(
          (summary) =>
            summary.id === record.id && summary.facility?.id && summary.processingPeriod?.id,
        ),
    )
    .map((record) => record.id);
  const resolved =
    missing.length && leases[0] ? await findBatchSummaries(missing, leases[0].session) : [];
  for (const record of records) {
    const lease = leases.find((lease) => lease.id === record.id);
    if (!lease) throw new LocalDataUnavailableError();
    const source = [...summaries, ...resolved].find(
      (summary) => summary.id === record.id && summary.facility?.id && summary.processingPeriod?.id,
    );
    let summary: CopySummary;
    if (source?.facility?.id && source.processingPeriod?.id) {
      summary = {
        ...source,
        status: record.status as CopySummary['status'],
        facility: { ...source.facility, id: source.facility.id },
        processingPeriod: { ...source.processingPeriod, id: source.processingPeriod.id },
      };
    } else throw new LocalDataUnavailableError();
    const access = await (accessMode === 'wait'
      ? waitForRequisitionAccess()
      : readRequisitionAccess());
    assertSessionScope(lease.session);
    const approvalNodes = nodesWithRight(
      access.access,
      access.saved.roles,
      RIGHTS.requisitionApprove,
      summary.program.id,
    );
    if (
      !approvalNodes.length ||
      (summary.supervisoryNode &&
        !mayApproveCopy(access, summary.facility.id, summary.program.id, summary.supervisoryNode))
    )
      throw new LocalDataUnavailableError();
    await commitCopy(lease, {
      id: record.id,
      userId: lease.userId,
      generation: lease.generation,
      formatVersion: 1,
      revision: 0,
      fetchedAt: Date.now(),
      summary,
      batch: {
        record,
        fetchedAt: Date.now(),
        currency,
        approvalNodes,
        requestedIds: leases.map((lease) => lease.id),
        errors: response.requisitionErrors ?? [],
      },
    });
    attachCopyLease(record, lease);
  }
}
export async function readBatch(ids: readonly string[]) {
  const access = await readRequisitionAccess();
  const copies = await Promise.all(ids.map(readCopy));
  const ready = copies.flatMap((copy) => (copy?.batch ? [{ ...copy, batch: copy.batch }] : []));
  if (ready.some((copy) => !mayApproveSavedCopy(access, copy)))
    throw new LocalDataUnavailableError();
  const errors = ids.flatMap((id, index) => {
    if (copies[index]?.batch) return [];
    const error = ready
      .flatMap((copy) => (copy.batch.requestedIds.includes(id) ? copy.batch.errors : []))
      .find((error) => error.requisitionId === id);
    if (!error) throw new LocalDataUnavailableError();
    return [error];
  });
  for (const copy of ready)
    attachCopyLease(copy.batch.record, {
      id: copy.id,
      userId: copy.userId,
      generation: copy.generation,
      session: getSessionScope(),
    });
  if (!ready.length) throw new LocalDataUnavailableError();
  return {
    response: {
      requisitionDtos: ready.map((copy) => copy.batch.record),
      requisitionErrors: errors,
    } satisfies BatchResponse,
    currency: ready[0].batch.currency,
    fetchedAt: Math.min(...ready.map((copy) => copy.batch.fetchedAt)),
  };
}
