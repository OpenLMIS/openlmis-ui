import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  clearInventoryLocal,
  INVENTORY_FORMAT_VERSION,
  inventoryReference,
  readInventoryLocal,
  readInventoryLocalByScope,
  readInventoryReference,
  reconcileInventoryCopies,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import { countUnsyncedDeviceWork } from '@/features/stock-events/lib/unsynced-device-work';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { DraftConflictError } from '@/lib/draft-store';
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
  vi.spyOn(getLocalDb().table(LOCAL_TABLES.physicalInventoryDrafts), 'put').mockRejectedValueOnce(
    new Error('Full'),
  );
  const value = snapshot();
  await expect(
    writeInventoryLocal(value, undefined, undefined, inventoryReference(value, [], [])),
  ).rejects.toThrow('Full');
  expect(await getLocalDb().table(LOCAL_TABLES.physicalInventoryReference).count()).toBe(0);
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

const snapshot = () => ({
  ...copy,
  formatVersion: INVENTORY_FORMAT_VERSION,
  baselineKeys: [],
  fetchedAt: 123,
  generation: 'open-1',
});

it('commits and clears the copy and reference together', async () => {
  const value = snapshot();
  const saved = await writeInventoryLocal(
    value,
    undefined,
    undefined,
    inventoryReference(value, [], []),
  );
  expect(await readInventoryReference(value)).toBeDefined();
  await clearInventoryLocal('d', saved?.revision);
  expect(await readInventoryLocal('d')).toBeUndefined();
  expect(await getLocalDb().table(LOCAL_TABLES.physicalInventoryReference).count()).toBe(0);
});

it('refuses references from another owner or generation and stale sessions', async () => {
  const value = snapshot();
  const ref = inventoryReference(value, [], []);
  await writeInventoryLocal(value, undefined, undefined, ref);
  expect(await readInventoryReference({ ...value, generation: 'different' })).toBeUndefined();
  await getLocalDb()
    .table(LOCAL_TABLES.physicalInventoryReference)
    .put({ ...ref, userId: 'other' });
  expect(await readInventoryReference(value)).toBeUndefined();
  await expect(
    writeInventoryLocal({ ...value, revision: 1 }, undefined, undefined, {
      ...ref,
      userId: 'other',
    }),
  ).rejects.toThrow();
  const session = getSessionScope();
  const db = getLocalDb();
  signIn('different-user');
  await expect(writeInventoryLocal(value, session, db, ref)).rejects.toThrow();
  await expect(clearInventoryLocal(value.draftId, 1, session, db)).rejects.toThrow();
});

it('a late open racing Delete cannot leave a reference behind', async () => {
  const value = snapshot();
  const ref = inventoryReference(value, [], []);
  const saved = await writeInventoryLocal(value, undefined, undefined, ref);
  await clearInventoryLocal('d', saved?.revision);
  await expect(
    writeInventoryLocal({ ...value, revision: saved?.revision }, undefined, undefined, ref),
  ).rejects.toBeInstanceOf(DraftConflictError);
  expect(await getLocalDb().table(LOCAL_TABLES.physicalInventoryReference).count()).toBe(0);
});

it('selects current B beside orphan A and still warns about unsynced A until discarded', async () => {
  const a = snapshot();
  await writeInventoryLocal(a, undefined, undefined, inventoryReference(a, [], []));
  const b = { ...snapshot(), draftId: 'b', fetchedAt: 124, modified: false };
  await writeInventoryLocal(b);
  const untouched = { ...snapshot(), draftId: 'untouched', modified: false };
  await writeInventoryLocal(untouched, undefined, undefined, inventoryReference(untouched, [], []));
  await reconcileInventoryCopies(copy, 'b');
  expect((await readInventoryLocalByScope(copy))?.draftId).toBe('b');
  expect((await readInventoryLocal('d'))?.orphaned).toBe(true);
  expect(await readInventoryLocal('untouched')).toBeUndefined();
  expect(
    await getLocalDb().table(LOCAL_TABLES.physicalInventoryReference).get('untouched'),
  ).toBeUndefined();
  expect(await countUnsyncedDeviceWork()).toBe(1);
  const orphan = await readInventoryLocal('d');
  await clearInventoryLocal('d', orphan?.revision);
  expect(await countUnsyncedDeviceWork()).toBe(0);
});

it.each([true, false])(
  'preserves a copy created after a stale request started (modified: %s)',
  async (modified) => {
    const recent = { ...snapshot(), modified, savedAt: 250, fetchedAt: 210 };
    await writeInventoryLocal(recent);
    await reconcileInventoryCopies(copy, undefined, 200);
    expect(await readInventoryLocal('d')).toMatchObject({ savedAt: 250 });
    expect((await readInventoryLocal('d'))?.orphaned).toBeFalsy();
  },
);
it('clears an orphan marker when the server confirms the current draft', async () => {
  await writeInventoryLocal({ ...copy, orphaned: true });
  await reconcileInventoryCopies(copy, 'd', 200);
  expect((await readInventoryLocal('d'))?.orphaned).toBe(false);
});

it('offers the newest current copy offline, never an orphan, and ordinary writes keep orphans', async () => {
  for (const [draftId, fetchedAt, orphaned] of [
    ['older', 1, false],
    ['newer', 2, false],
    ['orphan', 3, true],
  ] as const)
    await writeInventoryLocal({ ...snapshot(), draftId, fetchedAt, orphaned });
  expect((await readInventoryLocalByScope(copy))?.draftId).toBe('newer');
  const orphan = await readInventoryLocal('orphan');
  await expect(
    writeInventoryLocal({ ...snapshot(), draftId: 'orphan', revision: orphan?.revision }),
  ).rejects.toBeInstanceOf(DraftConflictError);
  expect((await readInventoryLocal('orphan'))?.orphaned).toBe(true);
});
