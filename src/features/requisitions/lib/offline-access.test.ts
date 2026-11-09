import { waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchMinimalFacilities,
  fetchPrograms,
  fetchRoles,
  fetchSupervisoryNodesByIds,
} from '@/features/reference-data/api/api';
import { minimalFacilitiesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { fetchApprovalList } from '@/features/requisitions/api/api';
import {
  mayApproveCopy,
  mayViewCopy,
  type RequisitionAccess,
  readRequisitionAccess,
  requisitionAccessProvider,
} from '@/features/requisitions/lib/offline-access';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { queryClient } from '@/integrations/tanstack-query';
import type { OfflineAccess } from '@/lib/offline-access';
import { captureBatch, readBatch } from './offline-batch';
import { beginCopy, readCopy, retireCopy } from './offline-copies';

vi.mock('@/features/reference-data/api/api', async (original) => ({
  ...(await original<typeof import('@/features/reference-data/api/api')>()),
  fetchMinimalFacilities: vi.fn(),
  fetchPrograms: vi.fn(),
  fetchRoles: vi.fn(),
  fetchSupervisoryNodesByIds: vi.fn(),
}));
vi.mock('@/features/requisitions/api/api', () => ({ fetchApprovalList: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  useLoginData.getState().setLoginData({
    referenceDataUserId: crypto.randomUUID(),
    username: 'owner',
    accessToken: 'token',
  });
});
function access(): { access: OfflineAccess; saved: RequisitionAccess } {
  const userId = useLoginData.getState().referenceDataUserId as string;
  const programs = [{ id: 'p', code: 'P', name: 'Medicines', active: true }];
  return {
    access: {
      userId,
      generation: 'access',
      fetchedAt: 1,
      formatVersion: 1,
      permissionStrings: ['REQUISITION_VIEW|f|p'],
      programs,
      homeFacility: null,
      user: {
        id: userId,
        username: 'owner',
        firstName: '',
        lastName: '',
        active: true,
        roleAssignments: [{ roleId: 'approve', programId: 'p', supervisoryNodeId: 'node' }],
      },
    },
    saved: {
      userId,
      generation: 'access',
      fetchedAt: 1,
      formatVersion: 1,
      roles: [
        {
          id: 'approve',
          name: 'Approver',
          rights: [{ id: 'right', name: 'REQUISITION_APPROVE', type: 'SUPERVISION' }],
        },
      ],
      nodes: [{ id: 'node', code: 'N', name: 'Node', requisitionGroup: { id: 'group' } }],
      groups: [
        {
          id: 'group',
          code: 'G',
          name: 'Group',
          supervisoryNode: { id: 'node', name: 'Node' },
          requisitionGroupProgramSchedules: [],
          memberFacilities: [{ id: 'f', code: 'F', name: 'Clinic', enabled: true }],
        },
      ],
      facilities: [{ id: 'f', code: 'F', name: 'Clinic', active: true }],
      programs,
    },
  };
}
it('uses exact saved VIEW pairs and APPROVE program/node assignments independently', () => {
  const data = access();
  expect(mayViewCopy(data, 'f', 'p')).toBe(true);
  expect(mayViewCopy(data, 'another', 'p')).toBe(false);
  expect(mayViewCopy(data, 'f', 'another')).toBe(false);
  expect(mayApproveCopy(data, 'f', 'p', 'node')).toBe(true);
  expect(mayApproveCopy(data, 'f', 'another', 'node')).toBe(false);
  expect(mayApproveCopy(data, 'f', 'p', 'another')).toBe(false);
  expect(mayApproveCopy(data, 'f', 'p')).toBe(true);
  expect(mayApproveCopy(data, 'another', 'p')).toBe(false);
});
it('retains the last complete choices after a newer general access download', async () => {
  const data = access();
  await getLocalDb().table(LOCAL_TABLES.offlineAccess).put(data.access);
  await getLocalDb().table(LOCAL_TABLES.requisitionAccess).put(data.saved);
  expect((await readRequisitionAccess()).saved.generation).toBe('access');
  await getLocalDb()
    .table(LOCAL_TABLES.offlineAccess)
    .put({ ...data.access, generation: 'renewed' });
  expect((await readRequisitionAccess()).saved.generation).toBe('access');
});
it('waits for the coordinator to publish matching choices when a record opens during sign-in', async () => {
  const { waitForRequisitionAccess } = await import('./offline-access');
  const data = access();
  const waiting = waitForRequisitionAccess();
  await getLocalDb().table(LOCAL_TABLES.offlineAccess).put(data.access);
  await getLocalDb().table(LOCAL_TABLES.requisitionAccess).put(data.saved);
  expect((await waiting).saved.generation).toBe('access');
});
it('retains server-authorized batch access without guessing a missing current node', async () => {
  const { mayApproveSavedCopy } = await import('./offline-access');
  const data = access();
  data.access.user.roleAssignments.push({
    roleId: 'approve',
    programId: 'p',
    supervisoryNodeId: 'later-node',
  });
  const copy = {
    summary: {
      id: 'r',
      status: 'IN_APPROVAL' as const,
      supervisoryNode: 'node',
      emergency: false,
      facility: { id: 'f' },
      processingPeriod: { id: 'period' },
      program: { id: 'p' },
    },
    batch: { approvalVerified: true, approvalNodes: ['node', 'later-node'] },
  };
  expect(mayApproveSavedCopy(data, copy)).toBe(true);
  data.access.user.roleAssignments.pop();
  expect(mayApproveSavedCopy(data, copy)).toBe(false);
  expect(
    mayApproveSavedCopy(data, { ...copy, batch: { approvalVerified: true, approvalNodes: [] } }),
  ).toBe(false);
});
it('reopens saved batch successes with their original per-record errors without inventing single copies', async () => {
  const { beginCopy, commitCopy } = await import('./offline-copies');
  const { readBatch } = await import('./offline-batch');
  const { readSingle } = await import('./offline-single');
  const data = access();
  await getLocalDb().table(LOCAL_TABLES.offlineAccess).put(data.access);
  await getLocalDb().table(LOCAL_TABLES.requisitionAccess).put(data.saved);
  const lease = await beginCopy('r');
  await commitCopy(lease, {
    id: 'r',
    userId: lease.userId,
    generation: lease.generation,
    formatVersion: 1,
    revision: 0,
    fetchedAt: 1,
    summary: {
      id: 'r',
      status: 'AUTHORIZED',
      emergency: false,
      facility: { id: 'f' },
      program: { id: 'p' },
      processingPeriod: { id: 'period' },
    },
    batch: {
      fetchedAt: 1,
      requestedIds: ['r', 'denied'],
      approvalNodes: ['node'],
      approvalVerified: true,
      errors: [{ requisitionId: 'denied', errorMessage: { message: 'Not authorized' } }],
      record: {
        id: 'r',
        status: 'AUTHORIZED',
        modifiedDate: 'old',
        facilityName: 'Clinic',
        periodName: 'November',
        requisitionLineItems: [],
      },
      currency: {
        currencyCode: 'USD',
        currencySymbol: '$',
        currencySymbolSide: 'left',
        currencyDecimalPlaces: 2,
        groupingSize: 3,
        groupingSeparator: ',',
        decimalSeparator: '.',
      },
    },
  });
  const batch = await readBatch(['r', 'denied']);
  expect(batch.response.requisitionDtos.map((record) => record.id)).toEqual(['r']);
  expect(batch.response.requisitionErrors).toMatchObject([{ requisitionId: 'denied' }]);
  await expect(readBatch(['r', 'unknown'])).rejects.toThrow();
  await expect(readSingle('r')).rejects.toThrow();
});

const summary = {
  id: 'r',
  status: 'AUTHORIZED' as const,
  emergency: false,
  facility: { id: 'f' },
  program: { id: 'p' },
  processingPeriod: { id: 'period' },
};
const batchRecord = {
  id: 'r',
  status: 'AUTHORIZED',
  modifiedDate: 'unchanged',
  facilityName: 'Clinic',
  periodName: 'November',
  requisitionLineItems: [],
};
const currency = {
  currencyCode: 'USD',
  currencySymbol: '$',
  currencySymbolSide: 'left' as const,
  currencyDecimalPlaces: 2,
  groupingSize: 3,
  groupingSeparator: ',',
  decimalSeparator: '.',
};
async function publish(data: ReturnType<typeof access>) {
  await getLocalDb().table(LOCAL_TABLES.offlineAccess).put(data.access);
  await getLocalDb().table(LOCAL_TABLES.requisitionAccess).put(data.saved);
}
function approvalPage(content: (typeof summary)[], number = 0, totalPages = 1) {
  return { content, number, totalPages, size: 100, totalElements: content.length };
}
it('reads fresh approval membership through later pages, rejects absent ids and preserves previous payloads', async () => {
  await publish(access());
  const lease = await beginCopy('r');
  vi.mocked(fetchApprovalList)
    .mockResolvedValueOnce(approvalPage([{ ...summary, id: 'unrelated' }], 0, 3))
    .mockResolvedValueOnce(approvalPage([summary], 1, 3));
  await captureBatch([lease], { requisitionDtos: [batchRecord] }, currency, 'read');
  expect(vi.mocked(fetchApprovalList).mock.calls.map(([query]) => query.page)).toEqual([0, 1]);
  const previous = await readCopy('r');
  vi.mocked(fetchApprovalList).mockResolvedValue(approvalPage([]));
  await captureBatch([lease], { requisitionDtos: [batchRecord] }, currency, 'read');
  expect(await readCopy('r')).toMatchObject({
    fetchedAt: previous?.fetchedAt,
    batch: { record: batchRecord },
  });
  await expect(readBatch(['r'])).rejects.toThrow();
});
it('does not certify a VIEW-only batch read from stale history and an unrelated APPROVE grant', async () => {
  const data = access();
  data.saved.groups[0].memberFacilities = [];
  await publish(data);
  vi.mocked(fetchApprovalList).mockResolvedValue(approvalPage([]));
  await captureBatch([await beginCopy('r')], { requisitionDtos: [batchRecord] }, currency, 'read');
  expect(await readCopy('r')).toBeUndefined();
});
it('recertifies dirty batch access after grant removal without changing quantities, baseline or unknown evidence', async () => {
  const data = access();
  data.access.user.roleAssignments.push({
    roleId: 'approve',
    programId: 'p',
    supervisoryNodeId: 'unrelated',
  });
  await publish(data);
  vi.mocked(fetchApprovalList).mockResolvedValue(approvalPage([summary]));
  const lease = await beginCopy('r');
  await captureBatch([lease], { requisitionDtos: [batchRecord] }, currency, 'read');
  const before = await readCopy('r');
  const draft = {
    draftId: 'r',
    userId: lease.userId,
    formatVersion: 1,
    revision: 1,
    approvedQuantities: { line: '7' },
    baselineModifiedDate: 'unchanged',
    baselineStatus: 'AUTHORIZED',
    unresolvedApproval: { attemptedAt: 'unknown' },
  };
  await getLocalDb().table(LOCAL_TABLES.requisitionBatchDrafts).put(draft);
  data.access.user.roleAssignments.pop();
  await publish(data);
  await expect(readBatch(['r'])).rejects.toThrow();
  await captureBatch([lease], { requisitionDtos: [batchRecord] }, currency, 'read');
  expect((await readCopy('r'))?.batch).toMatchObject({
    approvalNodes: ['node'],
    record: batchRecord,
    fetchedAt: before?.batch?.fetchedAt,
  });
  expect(await getLocalDb().table(LOCAL_TABLES.requisitionBatchDrafts).get('r')).toEqual(draft);
  await expect(readBatch(['r'])).resolves.toMatchObject({
    response: { requisitionDtos: [batchRecord] },
  });
});

it.each([401, 403, 503])(
  'preserves payload on approval-list failure %s and revokes only definitive denials',
  async (status) => {
    await publish(access());
    const lease = await beginCopy('r');
    vi.mocked(fetchApprovalList).mockResolvedValue(approvalPage([summary]));
    await captureBatch([lease], { requisitionDtos: [batchRecord] }, currency, 'read');
    const previous = await readCopy('r');
    vi.mocked(fetchApprovalList).mockRejectedValue(
      new AxiosError('Denied', String(status), undefined, undefined, { status } as never),
    );
    await expect(
      captureBatch([lease], { requisitionDtos: [batchRecord] }, currency, 'read'),
    ).rejects.toThrow();
    expect(await readCopy('r')).toMatchObject({
      fetchedAt: previous?.fetchedAt,
      batch: { record: batchRecord },
    });
    if (status === 403) await expect(readBatch(['r'])).rejects.toThrow();
    else await expect(readBatch(['r'])).resolves.toBeDefined();
  },
);

it('does not retain approval certification after a per-record batch read refusal', async () => {
  await publish(access());
  const lease = await beginCopy('r');
  vi.mocked(fetchApprovalList).mockResolvedValue(approvalPage([summary]));
  await captureBatch([lease], { requisitionDtos: [batchRecord] }, currency, 'read');
  const previous = await readCopy('r');
  await captureBatch(
    [lease],
    {
      requisitionDtos: [batchRecord],
      requisitionErrors: [{ requisitionId: 'r', errorMessage: { message: 'Not authorized' } }],
    },
    currency,
    'read',
  );
  expect(await readCopy('r')).toMatchObject({
    fetchedAt: previous?.fetchedAt,
    batch: { record: batchRecord },
  });
  await expect(readBatch(['r'])).rejects.toThrow();
});

it('saves the remaining approval copies when one record has left the approval list', async () => {
  await publish(access());
  vi.mocked(fetchApprovalList).mockResolvedValue(approvalPage([summary]));
  const leases = await Promise.all(['gone', 'r'].map(beginCopy));
  await captureBatch(
    leases,
    { requisitionDtos: [{ ...batchRecord, id: 'gone', status: 'APPROVED' }, batchRecord] },
    currency,
    'read',
  );
  expect((await readCopy('r'))?.batch?.record.id).toBe('r');
  expect(await readCopy('gone')).toBeUndefined();
  const saved = await readBatch(['gone', 'r']);
  expect(saved.response.requisitionDtos?.map((r) => r.id)).toEqual(['r']);
  expect(saved.response.requisitionErrors).toEqual([
    expect.objectContaining({ requisitionId: 'gone' }),
  ]);
});

it('reopens sibling batch copies after one saved requisition is retired', async () => {
  await publish(access());
  vi.mocked(fetchApprovalList).mockResolvedValue(
    approvalPage([summary, { ...summary, id: 'other' }]),
  );
  const leases = await Promise.all(['r', 'other'].map(beginCopy));
  await captureBatch(
    leases,
    { requisitionDtos: [batchRecord, { ...batchRecord, id: 'other' }] },
    currency,
    'read',
  );
  await retireCopy(leases[0]);
  const saved = await readBatch(['r', 'other']);
  expect(saved.response.requisitionDtos?.map((r) => r.id)).toEqual(['other']);
  expect(saved.response.requisitionErrors).toEqual([
    expect.objectContaining({ requisitionId: 'r' }),
  ]);
});

it('reopens siblings when an existing copy loses its approval-list membership', async () => {
  await publish(access());
  const leases = await Promise.all(['r', 'gone'].map(beginCopy));
  const response = { requisitionDtos: [batchRecord, { ...batchRecord, id: 'gone' }] };
  vi.mocked(fetchApprovalList).mockResolvedValue(
    approvalPage([summary, { ...summary, id: 'gone' }]),
  );
  await captureBatch(leases, response, currency, 'read');
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionBatchDrafts)
    .put({
      draftId: 'r',
      userId: leases[0].userId,
      formatVersion: 1,
      revision: 1,
      approvedQuantities: { line: '5' },
    });
  vi.mocked(fetchApprovalList).mockResolvedValue(approvalPage([summary]));
  await captureBatch(leases, response, currency, 'read');
  await captureBatch([leases[0]], { requisitionDtos: [batchRecord] }, currency, 'read');
  const saved = await readBatch(['r', 'gone']);
  expect(saved.response.requisitionDtos?.map((r) => r.id)).toEqual(['r']);
  expect(saved.response.requisitionErrors).toEqual([
    expect.objectContaining({ requisitionId: 'gone' }),
  ]);
});

it('filters batch membership by program and stops as soon as all requested ids are found', async () => {
  const { fetchBatchMembership } = await import('./offline-batch');
  const { getSessionScope } = await import('@/lib/session-scope');
  vi.mocked(fetchApprovalList).mockResolvedValueOnce(approvalPage([summary], 0, 50));
  const result = await fetchBatchMembership(['r'], getSessionScope(), 'p');
  expect(result).toMatchObject({ found: [summary], remaining: new Set() });
  expect(fetchApprovalList).toHaveBeenCalledExactlyOnceWith({
    page: 0,
    size: 100,
    sort: ['id,asc'],
    program: 'p',
  });
});

it('refreshes offline preparation separately from cached screen lookups', async () => {
  const data = access();
  data.access.user.roleAssignments = [];
  await publish(data);
  queryClient.setQueryData(minimalFacilitiesOptions().queryKey, data.saved.facilities);
  queryClient.setQueryData(programsOptions().queryKey, data.saved.programs);
  vi.mocked(fetchMinimalFacilities).mockResolvedValue(data.saved.facilities);
  vi.mocked(fetchPrograms).mockResolvedValue(data.saved.programs);
  vi.mocked(fetchRoles).mockResolvedValue([]);
  vi.mocked(fetchSupervisoryNodesByIds).mockResolvedValue([]);
  const task = requisitionAccessProvider.tasks(data.access)[0];
  const record = await task.fetch(new AbortController().signal);
  expect(record).toMatchObject({
    facilities: data.saved.facilities,
    programs: data.saved.programs,
  });
  expect(fetchMinimalFacilities).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ backgroundDownload: true }),
  );
  expect(fetchPrograms).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ backgroundDownload: true }),
  );
});

it('keeps screen and download requests separate and rejects preparation after the session changes', async () => {
  const data = access();
  data.access.user.roleAssignments = [];
  await publish(data);
  const response = Promise.withResolvers<typeof data.saved.facilities>();
  vi.mocked(fetchMinimalFacilities).mockReturnValue(response.promise);
  vi.mocked(fetchPrograms).mockResolvedValue(data.saved.programs);
  vi.mocked(fetchRoles).mockResolvedValue([]);
  const screenLookup = queryClient.fetchQuery(minimalFacilitiesOptions());
  const task = requisitionAccessProvider.tasks(data.access)[0];
  const preparing = task.fetch(new AbortController().signal);
  await waitFor(() => expect(fetchRoles).toHaveBeenCalled());
  const settled = Promise.allSettled([screenLookup, preparing]);
  useLoginData.getState().setLoginData({
    referenceDataUserId: crypto.randomUUID(),
    username: 'other',
    accessToken: 'other-token',
  });
  response.resolve(data.saved.facilities);
  const outcomes = await settled;
  expect(outcomes[1].status).toBe('rejected');
  expect(fetchMinimalFacilities).toHaveBeenCalledTimes(2);
});
