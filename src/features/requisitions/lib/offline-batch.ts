import { isAxiosError } from 'axios';
import { fetchApprovalList } from '@/features/requisitions/api/api';
import type { BatchResponse } from '@/features/requisitions/lib/batch-types';
import {
  mayApproveCopy,
  mayApproveSavedCopy,
  readRequisitionAccess,
  waitForRequisitionAccess,
} from '@/features/requisitions/lib/offline-access';
import {
  attachCopyLease,
  type CopyLease,
  type CopySummary,
  commitCopy,
  readCopy,
  revokeBatchApproval,
} from '@/features/requisitions/lib/offline-copies';
import type { SingleReferences } from '@/features/requisitions/lib/offline-single';
import type { ApprovalListRow } from '@/features/requisitions/lib/types';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { RIGHTS } from '@/lib/rights';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { supervisoryNodesWithRight } from '@/lib/supervisory-nodes';

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
  return { found, remaining };
}
export async function captureBatch(
  leases: CopyLease[],
  response: BatchResponse,
  currency: SingleReferences['currency'],
  accessMode: 'wait' | 'read' = 'wait',
) {
  const refused = new Set(response.requisitionErrors?.map((error) => error.requisitionId));
  for (const lease of leases) if (refused.has(lease.id)) await revokeBatchApproval(lease);
  const records = (response.requisitionDtos ?? []).filter((record) => !refused.has(record.id));
  if (!records.length) return;
  const session = leases[0]?.session;
  if (session === undefined) throw new LocalDataUnavailableError();
  let membership: Awaited<ReturnType<typeof findBatchSummaries>>;
  try {
    membership = await findBatchSummaries(
      records.map((record) => record.id),
      session,
    );
  } catch (error) {
    if (isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0))
      for (const lease of leases) await revokeBatchApproval(lease);
    throw error;
  }
  for (const id of membership.remaining) {
    const lease = leases.find((lease) => lease.id === id);
    if (lease) await revokeBatchApproval(lease);
  }
  if (membership.remaining.size) throw new LocalDataUnavailableError();
  for (const record of records) {
    const lease = leases.find((lease) => lease.id === record.id);
    if (!lease) throw new LocalDataUnavailableError();
    const source = membership.found.find(
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
    const approvalNodes = supervisoryNodesWithRight(
      access.access.user,
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
        approvalVerified: true,
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
  if (ready.some((copy) => !copy.batch.approvalVerified || !mayApproveSavedCopy(access, copy)))
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
    attachCopyLease(copy.batch.confirmedApproval ?? copy.batch.record, {
      id: copy.id,
      userId: copy.userId,
      generation: copy.generation,
      session: getSessionScope(),
    });
  if (!ready.length) throw new LocalDataUnavailableError();
  return {
    response: {
      requisitionDtos: ready.map((copy) => copy.batch.confirmedApproval ?? copy.batch.record),
      requisitionErrors: errors,
    } satisfies BatchResponse,
    currency: ready[0].batch.currency,
    fetchedAt: Math.min(...ready.map((copy) => copy.batch.fetchedAt)),
  };
}
