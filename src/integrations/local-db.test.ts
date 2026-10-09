import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { getLocalDb, localDatabaseName } from '@/integrations/local-db';

const signIn = (referenceDataUserId: string) =>
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId, username: referenceDataUserId, accessToken: 'token' });

function withProbeTable(name: string) {
  const db = new Dexie(name);
  db.version(2).stores({ probe: 'id' });
  return db;
}

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
  it('adds the inventory draft table while upgrading a version one database', async () => {
    signIn('inventory-upgrade');
    const name = getLocalDb().name;
    const old = new Dexie(name);
    old.version(1).stores({});
    await old.open();
    old.close();
    const db = getLocalDb();
    await db.open();
    expect(db.verno).toBe(2);
    await db.table('physicalInventoryDrafts').put({ draftId: 'draft', lines: [] });
    expect(await db.table('physicalInventoryDrafts').get('draft')).toEqual({
      draftId: 'draft',
      lines: [],
    });
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
    const asAda = withProbeTable(getLocalDb().name);
    await asAda.table('probe').put({ id: 1 });
    asAda.close();

    signIn('alan');
    const asAlan = withProbeTable(getLocalDb().name);

    expect(await asAlan.table('probe').count()).toBe(0);
    asAlan.close();
  });

  it('closes the database on sign-out', async () => {
    signIn('ada');
    const adas = getLocalDb();
    await adas.open();

    useLoginData.getState().clearLoginData();

    expect(adas.isOpen()).toBe(false);
  });
});
