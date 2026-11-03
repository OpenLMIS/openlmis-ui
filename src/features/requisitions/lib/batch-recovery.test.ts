import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { recoverBatchApprovals } from '@/features/requisitions/lib/batch-recovery';
import fp from '@/features/requisitions/lib/fixtures/batch/retrieveall-fp.json';
import { getLocalDb } from '@/integrations/local-db';

const security = vi.hoisted(() => ({ secure: true }));
vi.mock('@/lib/secure-context', () => ({
  get isSecureOrigin() {
    return security.secure;
  },
}));

const records = fp.requisitionDtos;
beforeEach(() =>
  useLoginData.getState().setLoginData({
    referenceDataUserId: crypto.randomUUID(),
    username: 'u',
    accessToken: 'token',
  }),
);
it.each([true, false])(
  'clears changed records but retains unchanged and refused uncertain evidence on secure=%s',
  async (secure) => {
    security.secure = secure;
    sessionStorage.clear();
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) throw new Error('Missing test user');
    const table = getLocalDb().table('requisitionBatchDrafts');
    const { writeBatchSessionMarker, readBatchSessionMarker } = await import(
      '@/features/requisitions/lib/batch-session-markers'
    );
    for (const record of records) {
      if (!secure) {
        writeBatchSessionMarker(userId, record.id, {
          userId,
          requisitionId: record.id,
          attemptedAt: 'now',
          baselineModifiedDate: record.modifiedDate,
          baselineStatus: record.status,
        });
        continue;
      }
      await table.put({
        draftId: record.id,
        userId,
        formatVersion: 1,
        revision: 1,
        baselineModifiedDate: record.modifiedDate,
        baselineStatus: record.status,
        approvedQuantities: {},
        unresolvedApproval: { attemptedAt: 'now' },
      });
    }
    const response = {
      requisitionDtos: [records[0], { ...records[1], modifiedDate: 'changed' }],
      requisitionErrors: [
        { requisitionId: records[2].id, errorMessage: { message: 'No permission' } },
      ],
    };
    const result = await recoverBatchApprovals(
      records.map((r) => r.id),
      response,
    );
    expect([...result.removed.keys()]).toEqual([records[1].id]);
    expect(result.response.requisitionDtos).toEqual([records[0]]);
    if (!secure) {
      expect(readBatchSessionMarker(userId, records[0].id)).toBeDefined();
      expect(readBatchSessionMarker(userId, records[1].id)).toBeUndefined();
      expect(readBatchSessionMarker(userId, records[2].id)).toBeDefined();
      return;
    }
    expect((await table.get(records[0].id)).unresolvedApproval).toBeDefined();
    expect(await table.get(records[1].id)).toBeUndefined();
    expect((await table.get(records[2].id)).unresolvedApproval).toBeDefined();
  },
);
