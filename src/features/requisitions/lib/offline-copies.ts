import type { BatchLocalDraft } from '@/features/requisitions/hooks/use-batch-drafts';
import type { RequisitionLocalDraft } from '@/features/requisitions/hooks/use-requisition-draft';
import type { BatchRequisition, BatchResponse } from '@/features/requisitions/lib/batch-types';
import type { SingleReferences } from '@/features/requisitions/lib/offline-single';
import type { ApprovalListRow, RequisitionRecord } from '@/features/requisitions/lib/types';
import { hasUnsyncedRequisitionDraft } from '@/features/requisitions/lib/unsynced-device-work';
import { getLocalDb, getLocalDbUserId, LOCAL_TABLES, localTable } from '@/integrations/local-db';
import { DraftConflictError } from '@/lib/draft-store';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { readOwnedRecord } from '@/lib/local-records';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export type CopyLease = { id: string; userId: string; generation: number; session: number };
export type CopySummary = ApprovalListRow & {
  facility: { id: string; code?: string | null; name?: string | null };
  processingPeriod: {
    id: string;
    name?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  supervisoryNode?: string | null;
};
export type RequisitionCopy = {
  id: string;
  userId: string;
  formatVersion: 1;
  generation: number;
  revision: number;
  fetchedAt: number;
  summary: CopySummary;
  single?: { record: RequisitionRecord; references: SingleReferences; fetchedAt: number };
  batch?: {
    record: BatchRequisition;
    fetchedAt: number;
    currency: SingleReferences['currency'];
    approvalNodes: string[];
    approvalVerified?: boolean;
    confirmedApproval?: BatchRequisition;
    requestedIds: string[];
    errors: NonNullable<BatchResponse['requisitionErrors']>;
  };
};
type Lifecycle = { id: string; generation: number };
const tables = [
  LOCAL_TABLES.requisitionCopies,
  LOCAL_TABLES.requisitionCopyLifecycles,
  LOCAL_TABLES.requisitionDrafts,
  LOCAL_TABLES.requisitionBatchDrafts,
];
export async function beginCopy(id: string): Promise<CopyLease> {
  const session = getSessionScope();
  const userId = getLocalDbUserId();
  const lifecycle = await localTable<Lifecycle>(LOCAL_TABLES.requisitionCopyLifecycles).get(id);
  assertSessionScope(session);
  return { id, userId, generation: lifecycle?.generation ?? 0, session };
}
export class RequisitionCopyRemovedError extends DraftConflictError {}
export async function assertCopyLease(lease: CopyLease) {
  assertSessionScope(lease.session);
  if (lease.userId !== getLocalDbUserId()) throw new LocalDataUnavailableError();
  const current = await localTable<Lifecycle>(LOCAL_TABLES.requisitionCopyLifecycles).get(lease.id);
  assertSessionScope(lease.session);
  if ((current?.generation ?? 0) !== lease.generation)
    throw new RequisitionCopyRemovedError(undefined);
}
export function completeSingle(record: RequisitionRecord, refs: SingleReferences) {
  if (
    !record ||
    !refs ||
    !record.facility ||
    !record.program ||
    !record.processingPeriod ||
    !record.template ||
    !Array.isArray(record.requisitionLineItems) ||
    !Array.isArray(refs.products) ||
    !Array.isArray(refs.approved) ||
    !Array.isArray(refs.messages) ||
    !refs.currency ||
    record.facility.id !== refs.facility?.id ||
    record.program.id !== refs.program?.id ||
    record.processingPeriod.id !== refs.period?.id
  )
    return false;
  const matches = (
    identities: readonly { id: string; versionNumber: number }[],
    records: readonly { id: string; meta?: { versionNumber?: number } }[],
  ) =>
    identities.every((identity) =>
      records.some((r) => r.id === identity.id && r.meta?.versionNumber === identity.versionNumber),
    );
  return (
    matches(
      [
        ...record.requisitionLineItems.map((line) => line.orderable),
        ...(record.availableProducts ?? []),
      ],
      refs.products,
    ) &&
    matches(
      record.requisitionLineItems.flatMap((line) =>
        line.approvedProduct ? [line.approvedProduct] : [],
      ),
      refs.approved,
    ) &&
    (!['AUTHORIZED', 'IN_APPROVAL'].includes(record.status) || !!refs.unskip)
  );
}
export function isCompleteCopy(copy: RequisitionCopy) {
  return (
    copy.formatVersion === 1 &&
    copy.summary?.id === copy.id &&
    !!copy.summary?.facility?.id &&
    !!copy.summary.program?.id &&
    !!copy.summary.processingPeriod?.id &&
    ((copy.single?.record.id === copy.id &&
      completeSingle(copy.single.record, copy.single.references)) ||
      (copy.batch?.record.id === copy.id &&
        Array.isArray(copy.batch.record.requisitionLineItems) &&
        !!copy.batch.currency &&
        Array.isArray(copy.batch.approvalNodes) &&
        copy.batch.approvalNodes.length > 0 &&
        Array.isArray(copy.batch.requestedIds) &&
        copy.batch.requestedIds.includes(copy.id) &&
        Array.isArray(copy.batch.errors)))
  );
}
export async function readCopy(id: string) {
  return readOwnedRecord<RequisitionCopy>(LOCAL_TABLES.requisitionCopies, id, {
    formats: [1],
    accept: isCompleteCopy,
  });
}
export async function readCopies() {
  const session = getSessionScope();
  const userId = getLocalDbUserId();
  const copies = await localTable<RequisitionCopy>(LOCAL_TABLES.requisitionCopies).toArray();
  assertSessionScope(session);
  return copies.filter((copy) => copy.userId === userId && isCompleteCopy(copy));
}
export function newerServerRecord(
  next: { modifiedDate?: string | null },
  previous: { modifiedDate?: string | null },
) {
  const timestamp = (value?: string | null) => (value ? Date.parse(value) : Number.NaN);
  const difference = timestamp(next.modifiedDate) - timestamp(previous.modifiedDate);
  if (difference !== 0) return difference > 0;
  const fraction = (value?: string | null) => (value?.match(/\.(\d+)/)?.[1] ?? '').padEnd(9, '0');
  return fraction(next.modifiedDate) > fraction(previous.modifiedDate);
}

export async function commitCopy(lease: CopyLease, next: RequisitionCopy) {
  const db = getLocalDb();
  await db.transaction('rw', tables, async () => {
    await assertCopyLease(lease);
    if (!isCompleteCopy(next) || next.userId !== lease.userId || next.id !== lease.id)
      throw new LocalDataUnavailableError();
    const table = localTable<RequisitionCopy>(LOCAL_TABLES.requisitionCopies);
    const previous = await readCopy(lease.id);
    const singleDraft = await localTable<RequisitionLocalDraft>(LOCAL_TABLES.requisitionDrafts).get(
      lease.id,
    );
    const batchDraft = await localTable<BatchLocalDraft>(LOCAL_TABLES.requisitionBatchDrafts).get(
      lease.id,
    );
    const singleDirty = singleDraft && hasUnsyncedRequisitionDraft(singleDraft);
    const batchDirty =
      batchDraft &&
      (Object.keys(batchDraft.approvedQuantities).length || batchDraft.unresolvedApproval);
    const single =
      singleDirty && previous?.single ? previous.single : (next.single ?? previous?.single);
    let batch =
      batchDirty && previous?.batch
        ? {
            ...previous.batch,
            approvalNodes: next.batch?.approvalNodes ?? previous.batch.approvalNodes,
            approvalVerified: next.batch?.approvalVerified ?? previous.batch.approvalVerified,
          }
        : (next.batch ?? previous?.batch);
    const confirmed = previous?.batch?.confirmedApproval;
    if (batch && confirmed) {
      const candidate = next.batch?.record;
      batch = {
        ...batch,
        confirmedApproval:
          candidate && newerServerRecord(candidate, confirmed) ? candidate : confirmed,
      };
    }
    const confirmedStatus = batch?.confirmedApproval;
    const summaryStatus =
      confirmedStatus && next.single && newerServerRecord(next.single.record, confirmedStatus)
        ? next.single.record.status
        : confirmedStatus?.status;
    await table.put({
      ...next,
      single,
      batch,
      summary: {
        ...((singleDirty || batchDirty) && previous ? previous.summary : next.summary),
        ...(summaryStatus && { status: summaryStatus as CopySummary['status'] }),
      },
      fetchedAt: (singleDirty || batchDirty) && previous ? previous.fetchedAt : next.fetchedAt,
      revision: (previous?.revision ?? 0) + 1,
    });
    await assertCopyLease(lease);
  });
  assertSessionScope(lease.session);
}
export async function removalDecision(id: string) {
  const db = getLocalDb();
  return db.transaction('r', tables, async () => {
    const lease = await beginCopy(id);
    const copy = await readCopy(id);
    const draft = await localTable<RequisitionLocalDraft>(LOCAL_TABLES.requisitionDrafts).get(id);
    const batch = await localTable<BatchLocalDraft>(LOCAL_TABLES.requisitionBatchDrafts).get(id);
    assertSessionScope(lease.session);
    if (
      (draft && (draft.userId !== lease.userId || draft.formatVersion !== 1)) ||
      (batch && (batch.userId !== lease.userId || batch.formatVersion !== 1))
    )
      throw new LocalDataUnavailableError();
    return {
      lease,
      copyRevision: copy?.revision,
      draftRevision: draft?.revision,
      dirty: !!draft && hasUnsyncedRequisitionDraft(draft),
      batchBlocked:
        !!batch && (!!Object.keys(batch.approvedQuantities).length || !!batch.unresolvedApproval),
    };
  });
}
export async function removeCopy(decision: Awaited<ReturnType<typeof removalDecision>>) {
  const db = getLocalDb();
  await db.transaction('rw', tables, async () => {
    await assertCopyLease(decision.lease);
    const current = await removalDecision(decision.lease.id);
    if (
      current.batchBlocked ||
      current.copyRevision !== decision.copyRevision ||
      current.draftRevision !== decision.draftRevision ||
      current.dirty !== decision.dirty
    )
      throw new DraftConflictError(undefined);
    await localTable(LOCAL_TABLES.requisitionCopies).delete(decision.lease.id);
    if (decision.dirty) await localTable(LOCAL_TABLES.requisitionDrafts).delete(decision.lease.id);
    await localTable<Lifecycle>(LOCAL_TABLES.requisitionCopyLifecycles).put({
      id: decision.lease.id,
      generation: decision.lease.generation + 1,
    });
    assertSessionScope(decision.lease.session);
  });
}

const leases = new WeakMap<object, CopyLease>();
export function attachCopyLease(record: object, lease: CopyLease) {
  leases.set(record, lease);
}
export const copyLeaseFor = (record: object) => leases.get(record);

export async function revokeBatchApproval(lease: CopyLease) {
  const db = getLocalDb();
  await db.transaction('rw', tables, async () => {
    await assertCopyLease(lease);
    const previous = await readCopy(lease.id);
    if (!previous?.batch) return;
    await localTable<RequisitionCopy>(LOCAL_TABLES.requisitionCopies).put({
      ...previous,
      batch: { ...previous.batch, approvalVerified: false },
      revision: previous.revision + 1,
    });
    await assertCopyLease(lease);
  });
}
export async function confirmBatchApproval(lease: CopyLease, record: BatchRequisition) {
  const db = getLocalDb();
  await db.transaction('rw', tables, async () => {
    await assertCopyLease(lease);
    const previous = await readCopy(lease.id);
    if (!previous?.batch?.approvalVerified || record.id !== lease.id) return;
    const draft = await localTable<BatchLocalDraft>(LOCAL_TABLES.requisitionBatchDrafts).get(
      lease.id,
    );
    const dirty =
      draft && (Object.keys(draft.approvedQuantities).length || draft.unresolvedApproval);
    const latest =
      previous.batch.confirmedApproval &&
      !newerServerRecord(record, previous.batch.confirmedApproval)
        ? previous.batch.confirmedApproval
        : record;
    await localTable<RequisitionCopy>(LOCAL_TABLES.requisitionCopies).put({
      ...previous,
      summary: { ...previous.summary, status: latest.status as CopySummary['status'] },
      batch: {
        ...previous.batch,
        record: dirty ? previous.batch.record : latest,
        confirmedApproval: latest,
        fetchedAt: dirty ? previous.batch.fetchedAt : Date.now(),
      },
      revision: previous.revision + 1,
    });
    await assertCopyLease(lease);
  });
}

export async function retireCopy(lease: CopyLease) {
  const db = getLocalDb();
  await db.transaction('rw', tables, async () => {
    await assertCopyLease(lease);
    await localTable(LOCAL_TABLES.requisitionCopies).delete(lease.id);
    await localTable<Lifecycle>(LOCAL_TABLES.requisitionCopyLifecycles).put({
      id: lease.id,
      generation: lease.generation + 1,
    });
    assertSessionScope(lease.session);
  });
  assertSessionScope(lease.session);
}
