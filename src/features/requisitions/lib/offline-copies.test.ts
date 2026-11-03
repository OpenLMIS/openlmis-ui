import { beforeEach, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { beginCopy, commitCopy, readCopies, removalDecision, removeCopy } from './offline-copies';

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
    status: 'INITIATED' as const,
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
