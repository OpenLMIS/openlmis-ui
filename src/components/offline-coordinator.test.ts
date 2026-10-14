import { waitFor } from '@testing-library/react';
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
