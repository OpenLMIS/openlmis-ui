import { beforeEach, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { recoverBatchApprovals } from '@/features/requisitions/lib/batch-recovery';
import fp from '@/features/requisitions/lib/fixtures/batch/retrieveall-fp.json';
import { getLocalDb } from '@/integrations/local-db';

const records = fp.requisitionDtos;
beforeEach(() =>
  useLoginData.getState().setLoginData({
    referenceDataUserId: crypto.randomUUID(),
    username: 'u',
    accessToken: 'token',
  }),
);
it('removes and clears changed, refused and missing uncertain records but keeps unchanged records blocked', async () => {
  const userId = useLoginData.getState().referenceDataUserId;
  const table = getLocalDb().table('requisitionBatchDrafts');
  for (const record of records)
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
  expect([...result.removed.keys()]).toEqual([records[1].id, records[2].id]);
  expect(result.response.requisitionDtos).toEqual([records[0]]);
  expect((await table.get(records[0].id)).unresolvedApproval).toBeDefined();
  expect(await table.get(records[1].id)).toBeUndefined();
  expect(await table.get(records[2].id)).toBeUndefined();
});
