import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  clearInventoryLocal,
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
  expect(await readInventoryLocal('d')).toEqual({ ...copy, revision: 1 });
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

it('rejects a stale inventory revision and stops its serial writer without overwriting the other tab', async () => {
  const { createInventoryWriter } = await import(
    '@/features/stock-events/lib/physical-inventory-autosave'
  );
  const { DraftConflictError } = await import('@/lib/draft-store');
  const initial = await writeInventoryLocal(copy);
  expect(initial).toBeDefined();
  const other = await writeInventoryLocal({ ...copy, revision: initial?.revision, savedAt: 2 });
  const status = vi.fn();
  const write = vi.fn(async (savedAt: number) => {
    await writeInventoryLocal({ ...copy, revision: initial?.revision, savedAt });
  });
  const writer = createInventoryWriter(write, status);
  writer.enqueue(3);
  await expect(writer.flush()).rejects.toBeInstanceOf(DraftConflictError);
  expect(status).toHaveBeenLastCalledWith('conflict');
  await expect(clearInventoryLocal('d', initial?.revision)).rejects.toBeInstanceOf(
    DraftConflictError,
  );
  writer.enqueue(4);
  await expect(writer.flush()).rejects.toBeInstanceOf(DraftConflictError);
  expect(write).toHaveBeenCalledTimes(1);
  expect(await readInventoryLocal('d')).toEqual(other);
});
