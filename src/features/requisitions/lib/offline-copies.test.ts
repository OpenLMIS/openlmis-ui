import { beforeEach, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import type { RequisitionStatus } from '@/lib/requisition-status';
import {
  beginCopy,
  commitCopy,
  confirmBatchApproval,
  readCopies,
  readCopy,
  removalDecision,
  removeCopy,
  retireCopy,
} from './offline-copies';
import type { SingleReferences } from './offline-single';

beforeEach(() => {
  const id = crypto.randomUUID();
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: id, username: id, accessToken: 'token' });
});
const bundle = (lease: Awaited<ReturnType<typeof beginCopy>>) => ({
  ...lease,
  formatVersion: 1 as const,
  fetchedAt: 1,
  revision: 1,
  summary: {
    id: 'r',
    emergency: false,
    status: 'INITIATED' as RequisitionStatus,
    facility: { id: 'f' },
    program: { id: 'p' },
    processingPeriod: { id: 'period' },
  },
  single: undefined,
  batch: undefined,
});
it('rejects incomplete copies rather than marking sparse deltas ready', async () => {
  const lease = await beginCopy('r');
  await getLocalDb().table(LOCAL_TABLES.requisitionDrafts).put({ draftId: 'r', formatVersion: 1 });
  await expect(commitCopy(lease, bundle(lease))).rejects.toThrow();
  expect(await readCopies()).toEqual([]);
  expect(await getLocalDb().table(LOCAL_TABLES.requisitionDrafts).get('r')).toBeDefined();
});
it('removal invalidates in-flight captures even when no payload was stored', async () => {
  const lease = await beginCopy('r');
  const decision = await removalDecision('r');
  await removeCopy(decision);
  await expect(commitCopy(lease, ready(lease))).rejects.toThrow();
  expect(await readCopies()).toEqual([]);
});
it('retains independent batch edits and uncertain approval evidence', async () => {
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionBatchDrafts)
    .put({
      draftId: 'r',
      userId: useLoginData.getState().referenceDataUserId,
      formatVersion: 1,
      revision: 2,
      approvedQuantities: {},
      unresolvedApproval: { attemptedAt: 'today' },
    });
  const decision = await removalDecision('r');
  expect(decision.batchBlocked).toBe(true);
  await expect(removeCopy(decision)).rejects.toThrow();
  expect(await getLocalDb().table(LOCAL_TABLES.requisitionBatchDrafts).get('r')).toBeDefined();
});

const ready = (lease: Awaited<ReturnType<typeof beginCopy>>) => ({
  ...bundle(lease),
  batch: {
    fetchedAt: 1,
    approvalNodes: ['node'],
    approvalVerified: true,
    requestedIds: [lease.id],
    errors: [],
    record: {
      id: lease.id,
      status: 'AUTHORIZED',
      modifiedDate: 'old',
      facilityName: 'Clinic',
      periodName: 'November',
      requisitionLineItems: [],
    },
    currency: {
      currencyCode: 'USD',
      currencySymbol: '$',
      currencySymbolSide: 'left' as const,
      currencyDecimalPlaces: 2,
      groupingSize: 3,
      groupingSeparator: ',',
      decimalSeparator: '.',
    },
  },
});
it('retains clean batch-only copies without counting them as unsynced work', async () => {
  const lease = await beginCopy('r');
  await commitCopy(lease, ready(lease));
  expect(await readCopies()).toHaveLength(1);
  const { countUnsyncedBatchDrafts, countUnsyncedRequisitionDrafts } = await import(
    './unsynced-device-work'
  );
  expect(await countUnsyncedBatchDrafts()).toBe(0);
  expect(await countUnsyncedRequisitionDrafts()).toBe(0);
});
it('rejects a stale confirmation after a newer capture and keeps its copy', async () => {
  const lease = await beginCopy('r');
  await commitCopy(lease, ready(lease));
  const decision = await removalDecision('r');
  await commitCopy(lease, ready(lease));
  await expect(removeCopy(decision)).rejects.toThrow();
  expect(await readCopies()).toHaveLength(1);
});
it('rejects capture after removal and permits a deliberate later online open', async () => {
  const lease = await beginCopy('r');
  await commitCopy(lease, ready(lease));
  await removeCopy(await removalDecision('r'));
  await expect(commitCopy(lease, ready(lease))).rejects.toThrow();
  const next = await beginCopy('r');
  await commitCopy(next, ready(next));
  expect(await readCopies()).toHaveLength(1);
});
it('rejects a stale dirty warning when an editor commits a new revision', async () => {
  const lease = await beginCopy('r');
  await commitCopy(lease, ready(lease));
  const decision = await removalDecision('r');
  const { buildRequisitionDraft } = await import('./draft');
  const { record } = await import('./fixtures/builders');
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionDrafts)
    .put({
      draftId: 'r',
      userId: lease.userId,
      formatVersion: 1,
      revision: 1,
      draft: {
        ...buildRequisitionDraft({
          ...record(),
          id: 'r',
          facility: { id: 'f' },
          processingPeriod: { id: 'period' },
          requisitionLineItems: [],
        }),
        draftStatusMessage: 'Do not lose this',
      },
    });
  await expect(removeCopy(decision)).rejects.toThrow();
  expect(await readCopies()).toHaveLength(1);
  expect(await getLocalDb().table(LOCAL_TABLES.requisitionDrafts).get('r')).toBeDefined();
});
it('keeps the batch baseline and timestamp while independent quantities are dirty', async () => {
  const lease = await beginCopy('r');
  await commitCopy(lease, ready(lease));
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionBatchDrafts)
    .put({
      draftId: 'r',
      userId: lease.userId,
      formatVersion: 1,
      revision: 1,
      approvedQuantities: { line: '7' },
      baselineModifiedDate: 'old',
      baselineStatus: 'AUTHORIZED',
    });
  const fresh = ready(lease);
  fresh.batch.record.modifiedDate = 'new';
  fresh.fetchedAt = 2;
  await commitCopy(lease, fresh);
  expect((await readCopies())[0]).toMatchObject({
    fetchedAt: 1,
    batch: { record: { modifiedDate: 'old' } },
  });
  await expect(removeCopy(await removalDecision('r'))).rejects.toThrow();
});
it('does not read foreign or unsupported records or publish across an owner switch', async () => {
  const lease = await beginCopy('r');
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionCopies)
    .put({ ...ready(lease), userId: 'foreign' });
  expect(await readCopies()).toEqual([]);
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionCopies)
    .put({ ...ready(lease), formatVersion: 2 });
  expect(await readCopies()).toEqual([]);
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'another', username: 'another', accessToken: 'token' });
  await expect(commitCopy(lease, ready(lease))).rejects.toThrow();
  expect(await readCopies()).toEqual([]);
});

it('records confirmed server advancement while preserving independent dirty single and batch baselines and unknown evidence', async () => {
  const { buildRequisitionDraft } = await import('./draft');
  const { record } = await import('./fixtures/builders');
  const lease = await beginCopy('r');
  const copy = ready(lease);
  const singleRecord = {
    ...record(),
    id: 'r',
    status: 'AUTHORIZED' as const,
    modifiedDate: 'old',
    facility: { id: 'f' },
    program: { id: 'p' },
    processingPeriod: { id: 'period' },
    requisitionLineItems: [],
  };
  const single = {
    record: singleRecord,
    fetchedAt: 1,
    references: {
      facility: {
        id: 'f',
        code: 'F',
        name: 'Clinic',
        active: true,
        enabled: true,
        type: { id: 'type', code: 'T', name: 'Type' },
        geographicZone: { id: 'zone', code: 'Z', name: 'Zone', level: { name: 'Level' } },
      },
      program: { id: 'p', code: 'P', name: 'Program', active: true },
      period: {
        id: 'period',
        name: 'November',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        durationInMonths: 1,
      },
      products: [],
      approved: [],
      messages: [],
      currency: copy.batch.currency,
      unskip: { unskipRequisition: true },
    } satisfies SingleReferences,
  };
  await commitCopy(lease, { ...copy, single });
  const singleDraft = {
    draftId: 'r',
    userId: lease.userId,
    formatVersion: 1,
    revision: 3,
    draft: { ...buildRequisitionDraft(singleRecord), draftStatusMessage: 'Independent work' },
  };
  const batchDraft = {
    draftId: 'r',
    userId: lease.userId,
    formatVersion: 1,
    revision: 4,
    baselineModifiedDate: 'old',
    baselineStatus: 'AUTHORIZED',
    approvedQuantities: { line: '7' },
    unresolvedApproval: { attemptedAt: 'unknown' },
  };
  await getLocalDb().table(LOCAL_TABLES.requisitionDrafts).put(singleDraft);
  await getLocalDb().table(LOCAL_TABLES.requisitionBatchDrafts).put(batchDraft);
  const confirmed = { ...copy.batch.record, status: 'APPROVED', modifiedDate: 'new' };
  await confirmBatchApproval(lease, confirmed);
  await getLocalDb()
    .table(LOCAL_TABLES.offlineAccess)
    .put({
      userId: lease.userId,
      formatVersion: 1,
      generation: 'g',
      fetchedAt: 1,
      permissionStrings: ['REQUISITION_VIEW|f|p'],
      programs: [single.references.program],
      homeFacility: null,
      user: { id: lease.userId, username: 'owner', active: true, roleAssignments: [] },
    });
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionAccess)
    .put({
      userId: lease.userId,
      formatVersion: 1,
      generation: 'g',
      fetchedAt: 1,
      roles: [],
      nodes: [],
      groups: [],
      programs: [single.references.program],
      facilities: [{ id: 'f', code: 'F', name: 'Clinic', active: true }],
    });
  const { readSingle } = await import('./offline-single');
  const reopened = await readSingle('r');
  expect(reopened.single.record.status).toBe('APPROVED');
  expect(reopened.single.record.modifiedDate).toBe(confirmed.modifiedDate);
  expect(await readCopy('r')).toMatchObject({
    summary: { status: 'APPROVED' },
    single,
    batch: { record: copy.batch.record, fetchedAt: 1, confirmedApproval: confirmed },
  });
  expect(await getLocalDb().table(LOCAL_TABLES.requisitionDrafts).get('r')).toEqual(singleDraft);
  expect(await getLocalDb().table(LOCAL_TABLES.requisitionBatchDrafts).get('r')).toEqual(
    batchDraft,
  );
  await commitCopy(lease, { ...copy, single });
  expect((await readCopy('r'))?.summary.status).toBe('APPROVED');
});
it('cannot recreate removed copies or certify an unverified copy from an approval response', async () => {
  const lease = await beginCopy('r');
  const copy = ready(lease);
  await commitCopy(lease, { ...copy, batch: { ...copy.batch, approvalVerified: false } });
  await confirmBatchApproval(lease, { ...copy.batch.record, status: 'APPROVED' });
  expect((await readCopy('r'))?.summary.status).toBe(copy.summary.status);
  await removeCopy(await removalDecision('r'));
  await expect(
    confirmBatchApproval(lease, { ...copy.batch.record, status: 'APPROVED' }),
  ).rejects.toThrow();
  expect(await readCopy('r')).toBeUndefined();
});

it('keeps confirmed status when an older clean capture finishes later, but accepts newer server evidence', async () => {
  const lease = await beginCopy('r');
  const stale = ready(lease);
  stale.summary.status = 'AUTHORIZED';
  stale.batch.record.modifiedDate = '2026-11-03T11:00:00Z';
  await commitCopy(lease, stale);
  await confirmBatchApproval(lease, {
    ...stale.batch.record,
    status: 'IN_APPROVAL',
    modifiedDate: '2026-11-03T11:01:00.000001Z',
  });
  await commitCopy(lease, stale);
  expect(await readCopy('r')).toMatchObject({
    summary: { status: 'IN_APPROVAL' },
    batch: { confirmedApproval: { status: 'IN_APPROVAL' } },
  });
  const newer = ready(lease);
  newer.summary.status = 'APPROVED';
  newer.batch.record = {
    ...newer.batch.record,
    status: 'APPROVED',
    modifiedDate: '2026-11-03T11:01:00.000002Z',
  };
  await commitCopy(lease, newer);
  expect(await readCopy('r')).toMatchObject({
    summary: { status: 'APPROVED' },
    batch: { confirmedApproval: { status: 'APPROVED' } },
  });
});

it('retires both representations after an action and prevents an old capture restoring them', async () => {
  const lease = await beginCopy('r');
  await commitCopy(lease, ready(lease));
  for (const name of [LOCAL_TABLES.requisitionDrafts, LOCAL_TABLES.requisitionBatchDrafts]) {
    await getLocalDb()
      .table(name)
      .bulkPut([{ draftId: 'r' }, { draftId: 'other' }]);
  }
  await retireCopy(lease);
  for (const name of [LOCAL_TABLES.requisitionDrafts, LOCAL_TABLES.requisitionBatchDrafts]) {
    expect(await getLocalDb().table(name).get('r')).toBeUndefined();
    expect(await getLocalDb().table(name).get('other')).toBeDefined();
  }
  expect(await readCopy('r')).toBeUndefined();
  await expect(commitCopy(lease, ready(lease))).rejects.toThrow();
});

it('refreshes the list status while retaining dirty batch values and their baseline', async () => {
  const lease = await beginCopy('r');
  const first = ready(lease);
  await commitCopy(lease, first);
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionBatchDrafts)
    .put({
      draftId: 'r',
      userId: lease.userId,
      formatVersion: 1,
      revision: 1,
      approvedQuantities: { line: 12 },
    });
  await commitCopy(lease, {
    ...first,
    summary: { ...first.summary, status: 'APPROVED' },
    batch: {
      ...first.batch,
      record: { ...first.batch.record, status: 'APPROVED', modifiedDate: 'new' },
    },
  });
  const copy = await readCopy('r');
  expect(copy?.summary.status).toBe('APPROVED');
  expect(copy?.batch?.record.status).toBe('AUTHORIZED');
  expect(await getLocalDb().table(LOCAL_TABLES.requisitionBatchDrafts).get('r')).toMatchObject({
    approvedQuantities: { line: 12 },
  });
});

it('retains the retired facility and period label on sibling batch errors', async () => {
  const first = await beginCopy('r');
  const sibling = await beginCopy('other');
  await commitCopy(first, ready(first));
  const copy = ready(sibling);
  copy.batch.requestedIds = ['r', 'other'];
  copy.summary.id = 'other';
  await commitCopy(sibling, copy);
  await retireCopy(first);
  expect((await readCopy('other'))?.batch?.errors[0]).toMatchObject({
    requisitionId: 'r',
    label: 'Clinic - November',
  });
});

it('checks large product identity sets without quadratic scans', async () => {
  const { completeSingle } = await import('./offline-copies');
  const { record, product } = await import('./fixtures/builders');
  const base = { ...record(), id: 'r', facility: { id: 'f' }, processingPeriod: { id: 'period' } };
  const products = Array.from({ length: 10003 }, (_, index) => ({
    ...product(),
    id: String(index),
  }));
  let reads = 0;
  const counted = products.map((product) => ({
    ...product,
    get id() {
      reads++;
      return product.id;
    },
  }));
  const refs = {
    products: counted,
    approved: [],
    messages: [],
    currency: {},
    facility: base.facility,
    program: base.program,
    period: base.processingPeriod,
  } as unknown as SingleReferences;
  expect(
    completeSingle(
      {
        ...base,
        requisitionLineItems: [],
        availableProducts: products.map((p) => ({ id: p.id, versionNumber: 1 })),
      },
      refs,
    ),
  ).toBe(true);
  expect(reads).toBeLessThan(products.length * 20);
});

it.each(['Sync', 'Approve'])(
  'retains newer single and batch records when opening capture finishes after %s',
  async (action) => {
    const { record } = await import('./fixtures/builders');
    const lease = await beginCopy('r');
    const copy = ready(lease);
    const singleRecord = {
      ...record(),
      id: 'r',
      status: 'AUTHORIZED' as RequisitionStatus,
      modifiedDate: '2026-11-04T10:00:00.000001Z',
      facility: { id: 'f' },
      program: { id: 'p' },
      processingPeriod: { id: 'period' },
      requisitionLineItems: [],
    };
    const single = {
      record: singleRecord,
      fetchedAt: 1,
      references: {
        facility: {
          id: 'f',
          code: 'F',
          name: 'Clinic',
          active: true,
          enabled: true,
          type: { id: 'type', code: 'T', name: 'Type' },
          geographicZone: { id: 'zone', code: 'Z', name: 'Zone', level: { name: 'Level' } },
        },
        program: { id: 'p', code: 'P', name: 'Program', active: true },
        period: {
          id: 'period',
          name: 'November',
          startDate: '2026-11-01',
          endDate: '2026-11-30',
          durationInMonths: 1,
        },
        products: [],
        approved: [],
        messages: [],
        currency: copy.batch.currency,
        unskip: { unskipRequisition: true },
      } satisfies SingleReferences,
    };

    copy.batch.record.modifiedDate = singleRecord.modifiedDate;
    const opening = { ...copy, single };
    await commitCopy(lease, opening);
    const fresh = {
      ...opening,
      fetchedAt: 2,
      summary: {
        ...opening.summary,
        status: action === 'Approve' ? ('APPROVED' as const) : ('AUTHORIZED' as const),
      },
      single: {
        ...single,
        record: { ...singleRecord, modifiedDate: '2026-11-04T10:00:00.000002Z' },
      },
      batch: {
        ...copy.batch,
        approvalNodes: ['new-node'],
        approvalVerified: false,
        errors: [{ requisitionId: 'r', errorMessage: { message: 'New failure' } }],
        record: {
          ...copy.batch.record,
          modifiedDate: '2026-11-04T10:00:00.000002Z',
          requisitionLineItems: [
            {
              id: 'saved-line',
              approvedQuantity: 25,
              skipped: false,
              orderable: {
                id: 'product',
                productCode: 'P',
                fullProductName: 'Product',
                netContent: 1,
                roundToZero: false,
              },
            },
          ],
        },
      },
    };
    fresh.single.record.status = fresh.summary.status;
    fresh.batch.record.status = fresh.summary.status;
    const access = Promise.withResolvers<void>();
    const openingCapture = access.promise.then(() => commitCopy(lease, opening));
    await commitCopy(lease, fresh);
    if (action === 'Approve') await confirmBatchApproval(lease, fresh.batch.record);
    access.resolve();
    await openingCapture;
    expect(await readCopy('r')).toMatchObject({
      single: fresh.single,
      batch: {
        record: fresh.batch.record,
        approvalNodes: fresh.batch.approvalNodes,
        approvalVerified: false,
        errors: fresh.batch.errors,
      },
      fetchedAt: fresh.fetchedAt,
      summary: fresh.summary,
    });
  },
);
