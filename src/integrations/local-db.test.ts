import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { getLocalDb, LOCAL_TABLES, localDatabaseName } from '@/integrations/local-db';

const signIn = (referenceDataUserId: string) =>
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId, username: referenceDataUserId, accessToken: 'token' });

beforeEach(() => useLoginData.getState().clearLoginData());
afterEach(() => useLoginData.getState().clearLoginData());

describe('localDatabaseName', () => {
  it('differs by user and by deployment', () => {
    const ada = localDatabaseName({ deployment: 'https://a.example/v2/', userId: 'ada' });

    expect(ada).not.toBe(
      localDatabaseName({ deployment: 'https://a.example/v2/', userId: 'alan' }),
    );
    expect(ada).not.toBe(localDatabaseName({ deployment: 'https://b.example/v2/', userId: 'ada' }));
    expect(ada.startsWith('openlmis-ui:')).toBe(true);
  });
});

describe('getLocalDb', () => {
  it.each([1, 2])('upgrades version %s without losing inventory drafts', async (version) => {
    signIn(`inventory-upgrade-${version}`);
    const old = new Dexie(getLocalDb().name);
    old.version(1).stores({});
    const draft = { draftId: 'existing-count', lines: [{ quantity: '12' }], savedAt: 123 };
    if (version === 2) {
      old.version(2).stores({ physicalInventoryDrafts: 'draftId' });
      await old.table(LOCAL_TABLES.physicalInventoryDrafts).put(draft);
    } else {
      await old.open();
    }
    old.close();

    const db = getLocalDb();
    await db.open();
    expect(db.verno).toBe(11);
    if (version === 1) await db.table(LOCAL_TABLES.physicalInventoryDrafts).put(draft);
    expect(await db.table(LOCAL_TABLES.physicalInventoryDrafts).get(draft.draftId)).toEqual(draft);
    expect(db.table(LOCAL_TABLES.offlineAccess).schema.primKey.keyPath).toBe('userId');
    expect(db.table(LOCAL_TABLES.homeStockDownloads).schema.primKey.keyPath).toEqual([
      'facilityId',
      'programId',
    ]);
  });

  it('needs someone signed in, since every database belongs to a user', () => {
    expect(() => getLocalDb()).toThrow();
  });

  it('opens the signed-in user database, and closes it for the next user', async () => {
    signIn('ada');
    const adas = getLocalDb();
    await adas.open();
    expect(getLocalDb()).toBe(adas);

    signIn('alan');
    const alans = getLocalDb();

    expect(alans.name).not.toBe(adas.name);
    expect(adas.isOpen()).toBe(false);
  });

  it('keeps the database open when the same user signs in again with a new token', async () => {
    signIn('ada');
    const adas = getLocalDb();
    await adas.open();

    useLoginData.getState().expireSession();
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'ada', username: 'ada', accessToken: 'new-token' });

    expect(getLocalDb()).toBe(adas);
    expect(adas.isOpen()).toBe(true);
  });

  it('never shows one user what another user stored', async () => {
    signIn('ada');
    const draft = { draftId: 'identity-probe', lines: [] };
    await getLocalDb().table(LOCAL_TABLES.physicalInventoryDrafts).put(draft);

    signIn('alan');
    expect(
      await getLocalDb().table(LOCAL_TABLES.physicalInventoryDrafts).get(draft.draftId),
    ).toBeUndefined();

    signIn('ada');
    expect(
      await getLocalDb().table(LOCAL_TABLES.physicalInventoryDrafts).get(draft.draftId),
    ).toEqual(draft);
  });

  it('closes the database on sign-out', async () => {
    signIn('ada');
    const adas = getLocalDb();
    await adas.open();

    useLoginData.getState().clearLoginData();

    expect(adas.isOpen()).toBe(false);
  });
});

it('opens an existing v6 database at v11 while preserving drafts, queues and receipts', async () => {
  signIn('queue-upgrade-v6');
  const old = new Dexie(getLocalDb().name);
  old.version(1).stores({});
  old.version(2).stores({ physicalInventoryDrafts: 'draftId' });
  old.version(3).stores({ offlineAccess: 'userId', adjustmentDownloads: '[facilityId+programId]' });
  old
    .version(4)
    .stores({ stockEventDrafts: 'draftId, [kind+facilityId+programId+state], updatedAt' });
  old.version(5).stores({
    stockEventQueue: '++sequence, &localEventId, draftId, [status+sequence]',
    stockEventSyncErrors: '&localEventId, [facilityId+programId], failedAt',
    stockEventReceipts: '[draftId+revision], &localEventId, serverEventId',
  });
  old.version(6).stores({});
  const rows = {
    physicalInventoryDrafts: { draftId: 'pi', lines: [{ quantity: '12' }] },
    offlineAccess: { userId: 'queue-upgrade-v6', generation: 'access' },
    adjustmentDownloads: { facilityId: 'facility', programId: 'program', generation: 'bundle' },
    stockEventDrafts: { draftId: 'draft', revision: 7, state: 'uncertain', lines: [] },
    stockEventQueue: { sequence: 1, localEventId: 'queued', status: 'uncertain', revision: 7 },
    stockEventSyncErrors: { localEventId: 'refused', history: [] },
    stockEventReceipts: { draftId: 'accepted', revision: 1, localEventId: 'accepted' },
  };
  for (const [table, row] of Object.entries(rows)) await old.table(table).put(row);
  old.close();
  const db = getLocalDb();
  await db.open();
  expect(db.verno).toBe(11);
  for (const [table, row] of Object.entries(rows)) {
    if (table === 'adjustmentDownloads') continue;
    expect(await db.table(table).toArray()).toEqual([row]);
  }
  expect(db.tables.some((table) => table.name === 'adjustmentDownloads')).toBe(false);
  expect(await db.table(LOCAL_TABLES.homeStockDownloads).count()).toBe(0);
  expect(await db.table(LOCAL_TABLES.stockCardHistory).count()).toBe(0);
  for (const table of [
    LOCAL_TABLES.stockEventQueue,
    LOCAL_TABLES.stockEventSyncErrors,
    LOCAL_TABLES.stockEventReceipts,
  ])
    expect(
      (db.table(table).schema.idxByName.localEventId ?? db.table(table).schema.primKey).unique,
    ).toBe(true);
});

it('removes v9 card histories while preserving home stock and unresolved work', async () => {
  signIn('history-upgrade-v9');
  const old = new Dexie(getLocalDb().name);
  old.version(9).stores({
    homeStockDownloads: '[facilityId+programId]',
    stockEventDrafts: 'draftId, [kind+facilityId+programId+state]',
    stockEventQueue: '++sequence, &localEventId, [status+sequence]',
    stockCardHistory: 'id, fetchedAt',
  });
  const rows = {
    homeStockDownloads: { facilityId: 'home', programId: 'program', generation: 'complete' },
    stockEventDrafts: { draftId: 'draft', revision: 3, state: 'uncertain' },
    stockEventQueue: { sequence: 1, localEventId: 'pending', status: 'uncertain' },
  };
  for (const [table, row] of Object.entries(rows)) await old.table(table).put(row);
  await old
    .table(LOCAL_TABLES.stockCardHistory)
    .put({ id: 'card', fetchedAt: 123, card: { id: 'card' } });
  old.close();
  const db = getLocalDb();
  await db.open();
  expect(db.verno).toBe(11);
  expect(await db.table(LOCAL_TABLES.stockCardHistory).count()).toBe(0);
  for (const [table, row] of Object.entries(rows))
    expect(await db.table(table).toArray()).toEqual([row]);
});
