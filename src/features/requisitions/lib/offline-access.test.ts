import { beforeEach, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  mayApproveCopy,
  mayViewCopy,
  type RequisitionAccess,
  readRequisitionAccess,
} from '@/features/requisitions/lib/offline-access';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import type { OfflineAccess } from '@/lib/offline-access';

beforeEach(() => {
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
it('requires a complete choices generation matching generic access and the current owner', async () => {
  const data = access();
  await getLocalDb().table(LOCAL_TABLES.offlineAccess).put(data.access);
  await getLocalDb().table(LOCAL_TABLES.requisitionAccess).put(data.saved);
  expect((await readRequisitionAccess()).saved.generation).toBe('access');
  await getLocalDb()
    .table(LOCAL_TABLES.offlineAccess)
    .put({ ...data.access, generation: 'renewed' });
  await expect(readRequisitionAccess()).rejects.toThrow();
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionAccess)
    .put({ ...data.saved, generation: 'renewed', userId: 'foreign' });
  await expect(readRequisitionAccess()).rejects.toThrow();
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
      emergency: false,
      facility: { id: 'f' },
      processingPeriod: { id: 'period' },
      program: { id: 'p' },
    },
    batch: { approvalNodes: ['node', 'later-node'] },
  };
  expect(mayApproveSavedCopy(data, copy)).toBe(true);
  data.access.user.roleAssignments.pop();
  expect(mayApproveSavedCopy(data, copy)).toBe(false);
  expect(mayApproveSavedCopy(data, { ...copy, batch: { approvalNodes: [] } })).toBe(false);
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
