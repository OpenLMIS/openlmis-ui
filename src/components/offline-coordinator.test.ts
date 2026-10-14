import { waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startOfflineCoordinator } from '@/components/offline-coordinator';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchUserPrograms, fetchUserRecord } from '@/features/reference-data/api/api';
import { getLocalDb } from '@/integrations/local-db';
import { readOfflineAccess } from '@/lib/offline-access';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchUserRecord: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchFacility: vi.fn(),
}));

let stop: (() => void) | undefined;
const signIn = () =>
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'coordinator-user',
    username: 'coordinator-user',
    accessToken: 'token',
  });

beforeEach(async () => {
  signIn();
  await getLocalDb().table('offlineAccess').clear();
  useLoginData.getState().clearLoginData();
  vi.stubGlobal('navigator', {
    locks: { request: vi.fn(async (_name, _options, run) => run({})) },
  });
  vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
  vi.mocked(fetchUserRecord).mockResolvedValue({
    id: 'coordinator-user',
    username: 'coordinator-user',
    firstName: '',
    lastName: '',
    active: true,
    homeFacilityId: null,
    roleAssignments: [],
  });
  vi.mocked(fetchUserPrograms).mockResolvedValue([]);
});
afterEach(() => {
  stop?.();
  useLoginData.getState().clearLoginData();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('refreshes a restored valid session on boot, including a complete empty access result', async () => {
  signIn();
  stop = startOfflineCoordinator();
  await waitFor(async () =>
    expect(await readOfflineAccess()).toMatchObject({
      userId: 'coordinator-user',
      permissionStrings: [],
      programs: [],
      homeFacility: null,
    }),
  );
  expect(fetchPermissionStrings).toHaveBeenCalledWith('coordinator-user', { session: false });
});

it('does not hold sign-in while a bootstrap is pending, and isolates a failed refresh', async () => {
  let release!: (value: string[]) => void;
  vi.mocked(fetchPermissionStrings).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  stop = startOfflineCoordinator();
  signIn();
  expect(useLoginData.getState().isAuthenticated).toBe(true);
  expect(fetchPermissionStrings).toHaveBeenCalledTimes(1);
  expect(await getLocalDb().table('offlineAccess').count()).toBe(0);
  release(['STOCK_ADJUST|home|program']);
  await waitFor(async () => expect(await readOfflineAccess()).toBeDefined());
  const previous = await readOfflineAccess();
  vi.mocked(fetchPermissionStrings).mockRejectedValueOnce(new AxiosError('No connection'));
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'coordinator-user',
    username: 'coordinator-user',
    accessToken: 'renewed',
  });
  await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalledTimes(2));
  expect(useLoginData.getState().expired).toBe(false);
  expect(await readOfflineAccess()).toEqual(previous);
});

it('keeps sign-in and the previous snapshot when device storage rejects a refresh', async () => {
  signIn();
  stop = startOfflineCoordinator();
  await waitFor(async () => expect(await readOfflineAccess()).toBeDefined());
  const previous = await readOfflineAccess();
  const write = vi
    .spyOn(getLocalDb().table('offlineAccess'), 'put')
    .mockRejectedValueOnce(new DOMException('Storage is full', 'QuotaExceededError'));
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'coordinator-user',
    username: 'coordinator-user',
    accessToken: 'renewed',
  });
  await waitFor(() => expect(write).toHaveBeenCalled());
  expect(useLoginData.getState().isAuthenticated).toBe(true);
  expect(await readOfflineAccess()).toEqual(previous);
  write.mockRestore();
});
