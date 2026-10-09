import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  clearInventoryLocal,
  dropObsoleteInventoryCopies,
  readInventoryLocal,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import { getLocalDb } from '@/integrations/local-db';
import { getSessionScope } from '@/lib/session-scope';

const signIn = (id: string) =>
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: id, username: id, accessToken: 'token' });
const copy = {
  draftId: 'd',
  programId: 'p',
  facilityId: 'f',
  lines: [],
  modified: true,
  savedAt: 1,
};
beforeEach(() => signIn(crypto.randomUUID()));
it('writes, reads and clears a draft in the owner database', async () => {
  await writeInventoryLocal(copy);
  expect(await readInventoryLocal('d')).toEqual(copy);
  await clearInventoryLocal('d');
  expect(await readInventoryLocal('d')).toBeUndefined();
});
it('never reads another user copy and drops a stale write', async () => {
  await writeInventoryLocal(copy);
  const scope = getSessionScope();
  const db = getLocalDb();
  signIn('other');
  expect(await readInventoryLocal('d')).toBeUndefined();
  await expect(writeInventoryLocal(copy, scope, db)).rejects.toThrow();
  expect(await readInventoryLocal('d')).toBeUndefined();
});
it('surfaces storage failure', async () => {
  vi.spyOn(getLocalDb().table('physicalInventoryDrafts'), 'put').mockRejectedValueOnce(
    new Error('Full'),
  );
  await expect(writeInventoryLocal(copy)).rejects.toThrow('Full');
});

it('drops obsolete copies only for this program and facility', async () => {
  await writeInventoryLocal(copy);
  await writeInventoryLocal({ ...copy, draftId: 'current' });
  await writeInventoryLocal({ ...copy, draftId: 'other-program', programId: 'other' });
  await dropObsoleteInventoryCopies({ programId: 'p', facilityId: 'f' }, 'current');
  expect(await readInventoryLocal('d')).toBeUndefined();
  expect(await readInventoryLocal('current')).toBeDefined();
  expect(await readInventoryLocal('other-program')).toBeDefined();
  await dropObsoleteInventoryCopies({ programId: 'p', facilityId: 'f' });
  expect(await readInventoryLocal('current')).toBeUndefined();
});
