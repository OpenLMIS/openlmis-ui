import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { getLocalDb, localDatabaseName } from '@/integrations/local-db';

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
      await old.table('physicalInventoryDrafts').put(draft);
    } else {
      await old.open();
    }
    old.close();

    const db = getLocalDb();
    await db.open();
    expect(db.verno).toBe(3);
    if (version === 1) await db.table('physicalInventoryDrafts').put(draft);
    expect(await db.table('physicalInventoryDrafts').get(draft.draftId)).toEqual(draft);
    expect(db.table('offlineAccess').schema.primKey.keyPath).toBe('userId');
    expect(db.table('adjustmentDownloads').schema.primKey.keyPath).toEqual([
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
    await getLocalDb().table('physicalInventoryDrafts').put(draft);

    signIn('alan');
    expect(await getLocalDb().table('physicalInventoryDrafts').get(draft.draftId)).toBeUndefined();

    signIn('ada');
    expect(await getLocalDb().table('physicalInventoryDrafts').get(draft.draftId)).toEqual(draft);
  });

  it('closes the database on sign-out', async () => {
    signIn('ada');
    const adas = getLocalDb();
    await adas.open();

    useLoginData.getState().clearLoginData();

    expect(adas.isOpen()).toBe(false);
  });
});
