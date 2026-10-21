import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { permissionsOptions } from '@/features/auth/api/queries';
import {
  ForbiddenError,
  isForbidden,
  requirePermissions,
  requireRight,
} from '@/features/auth/lib/access';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchFacility,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import {
  facilityOptions,
  homeFacilityOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import type { Facility, Program } from '@/features/reference-data/lib/types';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { isOfflineError } from '@/lib/http';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { type AccessReaders, refreshOfflineAccess } from '@/lib/offline-access';
import { hasProgramGrant, programGrants } from '@/lib/permissions';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { homeStockPrograms } from '@/lib/stock-programs';
import type { UserRecord } from '@/lib/user-types';

vi.mock('@/features/auth/api/api', async (original) => ({
  ...(await original<typeof import('@/features/auth/api/api')>()),
  fetchPermissionStrings: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', async (original) => ({
  ...(await original<typeof import('@/features/reference-data/api/api')>()),
  fetchFacility: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchUserRecord: vi.fn(),
}));

const user: UserRecord = {
  id: 'ada',
  username: 'ada',
  firstName: 'Ada',
  lastName: 'Lovelace',
  active: true,
  homeFacilityId: 'home',
  roleAssignments: [],
  extraData: { secret: 'discard' },
};
const programs: Program[] = [{ id: 'p1', code: 'MED', name: 'Medicines', active: true }];
const home: Facility = {
  id: 'home',
  code: 'HOME',
  name: 'Clinic',
  active: true,
  enabled: true,
  type: { id: 'type', code: 'CLINIC', name: 'Clinic' },
  geographicZone: { id: 'zone', code: 'ZONE', name: 'Zone', level: { name: 'District' } },
  supportedPrograms: [
    {
      id: 'p1',
      code: 'MED',
      name: 'Medicines',
      supportActive: true,
      supportLocallyFulfilled: true,
    },
  ],
  extraData: { secret: 'discard' },
};
const readers = (): AccessReaders => ({
  permissions: vi.fn().mockResolvedValue(['STOCK_ADJUST|home|p1']),
  user: vi.fn().mockResolvedValue(user),
  programs: vi.fn().mockResolvedValue(programs),
  home: vi.fn().mockResolvedValue(home),
});
const offline = new AxiosError('No connection', AxiosError.ERR_NETWORK);
const signIn = (id: string) =>
  useLoginData.getState().setLoginData({
    referenceDataUserId: id,
    username: id,
    accessToken: 'token',
  });
const queryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always' },
    },
  });

function saveAccess(readers: AccessReaders) {
  const scope = getSessionScope();
  return refreshOfflineAccess(readers, () => assertSessionScope(scope));
}

beforeEach(async () => {
  signIn('ada');
  await getLocalDb().table(LOCAL_TABLES.offlineAccess).clear();
  vi.stubGlobal('navigator', {
    locks: { request: vi.fn(async (_name, _options, run) => run({})) },
  });
  vi.mocked(fetchPermissionStrings).mockRejectedValue(offline);
  vi.mocked(fetchUserRecord).mockRejectedValue(offline);
  vi.mocked(fetchUserPrograms).mockRejectedValue(offline);
  vi.mocked(fetchFacility).mockRejectedValue(offline);
});
afterEach(() => {
  useLoginData.getState().clearLoginData();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('durable access', () => {
  it('reconstructs route rights, scoped grants and home programs after Query is cleared', async () => {
    await saveAccess(readers());
    const client = queryClient();
    client.setQueryData(permissionsOptions('ada').queryKey, {
      rights: new Set(['OBSOLETE']),
      grants: [],
    });
    client.clear();
    const permissions = await requirePermissions(client, 'STOCK_ADJUST');
    expect(hasProgramGrant(permissions, 'STOCK_ADJUST', 'home', 'p1')).toBe(true);
    expect(hasProgramGrant(permissions, 'STOCK_ADJUST', 'elsewhere', 'p1')).toBe(false);
    expect(hasProgramGrant(permissions, 'STOCK_ADJUST', 'home', 'p2')).toBe(false);
    await expect(requireRight(client, 'USERS_MANAGE')).rejects.toBeInstanceOf(ForbiddenError);
    const savedUser = await client.fetchQuery(userRecordOptions('ada'));
    const savedPrograms = await client.fetchQuery(userProgramsOptions('ada'));
    const savedHome = await client.fetchQuery(homeFacilityOptions(savedUser.homeFacilityId ?? ''));
    expect(
      homeStockPrograms({
        homeFacility: savedHome,
        programs: savedPrograms,
        grants: programGrants(permissions, 'STOCK_ADJUST'),
      }),
    ).toEqual(programs);
  });

  it('never supplies a device home lookup to a whole-record facility read', async () => {
    await saveAccess(readers());
    const client = queryClient();
    await client.fetchQuery(homeFacilityOptions('home'));
    await expect(client.fetchQuery(facilityOptions('home'))).rejects.toBe(offline);
    expect(client.getQueryData(facilityOptions('home').queryKey)).toBeUndefined();
  });

  it.each([true, false])(
    'reuses fallback access for 30 seconds on repeated navigation (browser online: %s)',
    async (online) => {
      await saveAccess(readers());
      onlineManager.setOnline(online);
      const timeout = new AxiosError('Read timed out', AxiosError.ECONNABORTED);
      vi.mocked(fetchPermissionStrings).mockRejectedValue(timeout);
      vi.mocked(fetchUserRecord).mockRejectedValue(timeout);
      vi.mocked(fetchUserPrograms).mockRejectedValue(timeout);
      vi.mocked(fetchFacility).mockRejectedValue(timeout);
      let now = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => now);
      const client = queryClient();
      const read = async () => {
        await requireRight(client, 'STOCK_ADJUST');
        await client.fetchQuery(userRecordOptions('ada'));
        await client.fetchQuery(userProgramsOptions('ada'));
        await client.fetchQuery(homeFacilityOptions('home'));
      };
      await read();
      now += 29_999;
      await read();
      for (const fetch of [
        fetchPermissionStrings,
        fetchUserRecord,
        fetchUserPrograms,
        fetchFacility,
      ])
        expect(fetch).toHaveBeenCalledTimes(online ? 1 : 0);
      now += 1;
      await read();
      for (const fetch of [
        fetchPermissionStrings,
        fetchUserRecord,
        fetchUserPrograms,
        fetchFacility,
      ])
        expect(fetch).toHaveBeenCalledTimes(online ? 2 : 0);
      client.clear();
    },
  );

  it('refreshes device access before a route can reuse revoked rights after reconnect', async () => {
    await saveAccess(readers());
    const client = queryClient();
    client.setQueryData(userProgramsOptions('ada').queryKey, programs, { updatedAt: 1 });
    onlineManager.setOnline(false);
    await requireRight(client, 'STOCK_ADJUST');
    await client.fetchQuery(userRecordOptions('ada'));
    await client.fetchQuery(userProgramsOptions('ada'));
    await client.fetchQuery(homeFacilityOptions('home'));

    vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
    vi.mocked(fetchUserRecord).mockResolvedValue({ ...user, homeFacilityId: null });
    vi.mocked(fetchUserPrograms).mockResolvedValue([]);
    vi.mocked(fetchFacility).mockResolvedValue({ ...home, supportedPrograms: [] });
    onlineManager.setOnline(true);

    await expect(requireRight(client, 'STOCK_ADJUST')).rejects.toBeInstanceOf(ForbiddenError);
    expect((await client.fetchQuery(userRecordOptions('ada'))).homeFacilityId).toBeNull();
    expect(await client.fetchQuery(userProgramsOptions('ada'))).toEqual([]);
    expect((await client.fetchQuery(homeFacilityOptions('home'))).supportedPrograms).toEqual([]);
    expect(fetchPermissionStrings).toHaveBeenCalledTimes(1);
  });

  it('refetches mounted device rights immediately on reconnect within the fresh window', async () => {
    await saveAccess(readers());
    onlineManager.setOnline(false);
    const client = queryClient();
    await requireRight(client, 'STOCK_ADJUST');
    client.mount();
    const observer = new QueryObserver(client, permissionsOptions('ada'));
    const unsubscribe = observer.subscribe(() => {});
    try {
      expect(fetchPermissionStrings).not.toHaveBeenCalled();
      vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
      onlineManager.setOnline(true);
      await waitFor(() => expect(observer.getCurrentResult().data?.rights.size).toBe(0));
      expect(fetchPermissionStrings).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      client.unmount();
      client.clear();
    }
  });

  it('missing access is an offline failure, never a forbidden or not-found result', async () => {
    const error = await requireRight(queryClient(), 'STOCK_ADJUST').catch((error) => error);
    expect(error).toBeInstanceOf(LocalDataUnavailableError);
    expect(isOfflineError(error)).toBe(true);
    expect(isForbidden(error)).toBe(false);
  });

  it('keeps the previous complete generation when any snapshot part fails', async () => {
    await saveAccess(readers());
    const previous = await getLocalDb().table(LOCAL_TABLES.offlineAccess).get('ada');
    const failing = readers();
    vi.mocked(failing.permissions).mockResolvedValue(['USERS_MANAGE']);
    vi.mocked(failing.home).mockRejectedValue(offline);
    await expect(saveAccess(failing)).rejects.toBe(offline);
    expect(await getLocalDb().table(LOCAL_TABLES.offlineAccess).get('ada')).toEqual(previous);
    expect(previous).not.toHaveProperty('user.extraData');
    expect(previous).not.toHaveProperty('homeFacility.extraData');
    expect(JSON.stringify(previous)).not.toContain('token');
  });

  it('writes nothing when a held snapshot completes after identity changes', async () => {
    let release!: (value: Facility) => void;
    let homeStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      homeStarted = resolve;
    });
    const pending = readers();
    vi.mocked(pending.home).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
          homeStarted();
        }),
    );
    const run = saveAccess(pending);
    await started;
    signIn('alan');
    release(home);
    await expect(run).rejects.toBeInstanceOf(SessionEndedError);
    expect(await getLocalDb().table(LOCAL_TABLES.offlineAccess).count()).toBe(0);
    signIn('ada');
    expect(await getLocalDb().table(LOCAL_TABLES.offlineAccess).count()).toBe(0);
  });

  it('retains the owner snapshot on sign-out but never lends it to another user', async () => {
    await saveAccess(readers());
    useLoginData.getState().clearLoginData();
    signIn('alan');
    await expect(requireRight(queryClient(), 'STOCK_ADJUST')).rejects.toBeInstanceOf(
      LocalDataUnavailableError,
    );
    await expect(queryClient().fetchQuery(userRecordOptions('ada'))).rejects.toBeInstanceOf(
      LocalDataUnavailableError,
    );
    signIn('ada');
    await expect(requireRight(queryClient(), 'STOCK_ADJUST')).resolves.toEqual(
      new Set(['STOCK_ADJUST']),
    );
  });

  it('never falls back after a definitive 403 server response', async () => {
    const status = 403;
    await saveAccess(readers());
    const failure = Object.assign(new AxiosError('Server refusal'), { response: { status } });
    vi.mocked(fetchPermissionStrings).mockRejectedValue(failure);
    vi.mocked(fetchUserRecord).mockRejectedValue(failure);
    vi.mocked(fetchUserPrograms).mockRejectedValue(failure);
    vi.mocked(fetchFacility).mockRejectedValue(failure);
    const client = queryClient();
    await expect(requireRight(client, 'STOCK_ADJUST')).rejects.toBe(failure);
    await expect(client.fetchQuery(userRecordOptions('ada'))).rejects.toBe(failure);
    await expect(client.fetchQuery(userProgramsOptions('ada'))).rejects.toBe(failure);
    await expect(client.fetchQuery(homeFacilityOptions('home'))).rejects.toBe(failure);
  });

  it.each([true, false])(
    'online queries never persist access parts (Web Locks: %s)',
    async (locks) => {
      if (!locks) vi.stubGlobal('navigator', {});
      vi.mocked(fetchPermissionStrings).mockResolvedValue(['STOCK_ADJUST|home|p1']);
      vi.mocked(fetchUserRecord).mockResolvedValue(user);
      vi.mocked(fetchUserPrograms).mockResolvedValue(programs);
      vi.mocked(fetchFacility).mockResolvedValue(home);
      const client = queryClient();
      await requireRight(client, 'STOCK_ADJUST');
      await client.fetchQuery(userRecordOptions('ada'));
      await client.fetchQuery(userProgramsOptions('ada'));
      await client.fetchQuery(homeFacilityOptions('home'));
      expect(await getLocalDb().table(LOCAL_TABLES.offlineAccess).count()).toBe(0);
    },
  );
});

it('reads downloaded access without a session wait when offline and expired', async () => {
  signIn('ada');
  await saveAccess(readers());
  useLoginData.getState().expireSession();
  onlineManager.setOnline(false);
  vi.mocked(fetchPermissionStrings).mockReturnValue(new Promise(() => {}));
  const permissions = await queryClient().fetchQuery(permissionsOptions('ada'));
  expect(hasProgramGrant(permissions, 'STOCK_ADJUST', 'home', 'p1')).toBe(true);
  expect(fetchPermissionStrings).not.toHaveBeenCalled();
});

it('starts independent access reads together and reads home as soon as the user arrives', async () => {
  const pending = Promise.withResolvers<string[]>();
  const access = readers();
  vi.mocked(access.permissions).mockReturnValue(pending.promise);
  const result = saveAccess(access);
  try {
    await waitFor(() => expect(access.home).toHaveBeenCalledWith('home'));
    expect(access.programs).toHaveBeenCalledWith('ada');
  } finally {
    pending.resolve([]);
    await result;
  }
});
