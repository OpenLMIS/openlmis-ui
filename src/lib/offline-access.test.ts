import { QueryClient } from '@tanstack/react-query';
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
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import type { Facility, Program } from '@/features/reference-data/lib/types';
import { getLocalDb } from '@/integrations/local-db';
import { isOfflineError } from '@/lib/http';
import { LocalDataUnavailableError } from '@/lib/local-data';
import {
  type AccessReaders,
  bootstrapOfflineAccess,
  readOfflineAccess,
} from '@/lib/offline-access';
import { hasProgramGrant, programGrants } from '@/lib/permissions';
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

beforeEach(async () => {
  signIn('ada');
  await getLocalDb().table('offlineAccess').clear();
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
    await bootstrapOfflineAccess(readers());
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
    const savedHome = await client.fetchQuery(facilityOptions(savedUser.homeFacilityId ?? ''));
    expect(
      homeStockPrograms({
        homeFacility: savedHome,
        programs: savedPrograms,
        grants: programGrants(permissions, 'STOCK_ADJUST'),
      }),
    ).toEqual(programs);
  });

  it('missing access is an offline failure, never a forbidden or not-found result', async () => {
    const error = await requireRight(queryClient(), 'STOCK_ADJUST').catch((error) => error);
    expect(error).toBeInstanceOf(LocalDataUnavailableError);
    expect(isOfflineError(error)).toBe(true);
    expect(isForbidden(error)).toBe(false);
  });

  it('keeps the previous complete generation when any bootstrap part fails', async () => {
    await bootstrapOfflineAccess(readers());
    const previous = await readOfflineAccess();
    const failing = readers();
    vi.mocked(failing.permissions).mockResolvedValue(['USERS_MANAGE']);
    vi.mocked(failing.home).mockRejectedValue(offline);
    await expect(bootstrapOfflineAccess(failing)).rejects.toBe(offline);
    expect(await readOfflineAccess()).toEqual(previous);
    expect(previous).not.toHaveProperty('user.extraData');
    expect(previous).not.toHaveProperty('homeFacility.extraData');
    expect(JSON.stringify(previous)).not.toContain('token');
  });

  it('writes nothing when a held bootstrap completes after identity changes', async () => {
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
    const run = bootstrapOfflineAccess(pending);
    await started;
    signIn('alan');
    release(home);
    await expect(run).rejects.toBeInstanceOf(SessionEndedError);
    expect(await getLocalDb().table('offlineAccess').count()).toBe(0);
    signIn('ada');
    expect(await getLocalDb().table('offlineAccess').count()).toBe(0);
  });

  it('does not download or write when another tab owns the database download lock', async () => {
    const request = vi.fn(async (_name, _options, run) => run(null));
    vi.stubGlobal('navigator', { locks: { request } });
    const raw = readers();
    await bootstrapOfflineAccess(raw);
    expect(request).toHaveBeenCalledWith(
      `${getLocalDb().name}:offline-download`,
      { ifAvailable: true },
      expect.any(Function),
    );
    expect(raw.permissions).not.toHaveBeenCalled();
    expect(await getLocalDb().table('offlineAccess').count()).toBe(0);
  });

  it('retains the owner snapshot on sign-out but never lends it to another user', async () => {
    await bootstrapOfflineAccess(readers());
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

  it.each([401, 403, 404, 500])(
    'never falls back after a definitive %s server response',
    async (status) => {
      await bootstrapOfflineAccess(readers());
      const failure = Object.assign(new AxiosError('Server refusal'), { response: { status } });
      vi.mocked(fetchPermissionStrings).mockRejectedValue(failure);
      vi.mocked(fetchUserRecord).mockRejectedValue(failure);
      vi.mocked(fetchUserPrograms).mockRejectedValue(failure);
      vi.mocked(fetchFacility).mockRejectedValue(failure);
      const client = queryClient();
      await expect(requireRight(client, 'STOCK_ADJUST')).rejects.toBe(failure);
      await expect(client.fetchQuery(userRecordOptions('ada'))).rejects.toBe(failure);
      await expect(client.fetchQuery(userProgramsOptions('ada'))).rejects.toBe(failure);
      await expect(client.fetchQuery(facilityOptions('home'))).rejects.toBe(failure);
    },
  );

  it.each([true, false])(
    'online queries never persist access parts (Web Locks: %s)',
    async (locks) => {
      if (!locks) {
        vi.stubGlobal('navigator', {});
        const raw = readers();
        await bootstrapOfflineAccess(raw);
        expect(raw.permissions).not.toHaveBeenCalled();
      }
      vi.mocked(fetchPermissionStrings).mockResolvedValue(['STOCK_ADJUST|home|p1']);
      vi.mocked(fetchUserRecord).mockResolvedValue(user);
      vi.mocked(fetchUserPrograms).mockResolvedValue(programs);
      vi.mocked(fetchFacility).mockResolvedValue(home);
      const client = queryClient();
      await requireRight(client, 'STOCK_ADJUST');
      await client.fetchQuery(userRecordOptions('ada'));
      await client.fetchQuery(userProgramsOptions('ada'));
      await client.fetchQuery(facilityOptions('home'));
      expect(await getLocalDb().table('offlineAccess').count()).toBe(0);
    },
  );
});
