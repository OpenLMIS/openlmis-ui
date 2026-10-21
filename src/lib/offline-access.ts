import { useLoginData } from '@/features/auth/store/login-data';
import type { Facility, Program } from '@/features/reference-data/lib/types';
import { getLocalDbUserId, LOCAL_TABLES } from '@/integrations/local-db';
import { deviceDataGeneration, LocalDataUnavailableError, onlineOrDevice } from '@/lib/local-data';
import { putOwnedRecord, requireOwnedRecord } from '@/lib/local-records';
import { OFFLINE_FRESH_FOR } from '@/lib/offline-freshness';
import { getConnectionGeneration } from '@/lib/online';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { UserRecord } from '@/lib/user-types';

export type OfflineAccess = {
  userId: string;
  permissionStrings: string[];
  user: UserRecord;
  programs: Program[];
  homeFacility: Facility | null;
  fetchedAt: number;
  generation: string;
  formatVersion: 1;
};

export type AccessReaders = {
  permissions: (userId: string) => Promise<string[]>;
  user: (userId: string) => Promise<UserRecord>;
  programs: (userId: string) => Promise<Program[]>;
  home: (facilityId: string) => Promise<Facility>;
};

export async function readOfflineAccess() {
  let userId: string;
  try {
    userId = getLocalDbUserId();
  } catch {
    throw new LocalDataUnavailableError();
  }
  return requireOwnedRecord<OfflineAccess>(LOCAL_TABLES.offlineAccess, userId, {
    formats: [1],
  });
}

const DEVICE_ACCESS_FRESH_FOR = 30_000;
export const isDeviceAccess = (value: unknown) => deviceDataGeneration(value) !== undefined;
function offlineAccessStaleTime(value: unknown, serverStaleTime: number) {
  const generation = deviceDataGeneration(value);
  if (generation === undefined) return serverStaleTime;
  return generation === getConnectionGeneration() ? DEVICE_ACCESS_FRESH_FOR : 0;
}

export function offlineAccessQuery(serverStaleTime: number) {
  return {
    structuralSharing: false as const,
    refetchOnReconnect: true as const,
    staleTime: (query: { state: { data: unknown } }) =>
      offlineAccessStaleTime(query.state.data, serverStaleTime),
  };
}

export async function withOfflineAccess<T extends object>(
  online: () => Promise<T>,
  select: (saved: OfflineAccess) => T | undefined,
): Promise<T> {
  const scope = getSessionScope();
  const device = async () => {
    const saved = await readOfflineAccess();
    assertSessionScope(scope);
    const result = select(saved);
    if (result === undefined) throw new LocalDataUnavailableError();
    return result;
  };
  return onlineOrDevice(online, device);
}

function snapshotUser(user: UserRecord): UserRecord {
  const { id, username, firstName, lastName, active, homeFacilityId, roleAssignments } = user;
  return {
    id,
    username,
    firstName,
    lastName,
    active,
    homeFacilityId,
    roleAssignments: roleAssignments.map(
      ({ roleId, programId, supervisoryNodeId, warehouseId }) => ({
        roleId,
        programId,
        supervisoryNodeId,
        warehouseId,
      }),
    ),
  };
}

function snapshotHome(home: Facility): Facility {
  const { id, code, name, active, enabled, type, geographicZone, supportedPrograms } = home;
  return {
    id,
    code,
    name,
    active,
    enabled,
    type: { id: type.id, code: type.code, name: type.name },
    geographicZone: {
      id: geographicZone.id,
      code: geographicZone.code,
      name: geographicZone.name,
      level: { name: geographicZone.level.name, levelNumber: geographicZone.level.levelNumber },
    },
    supportedPrograms: supportedPrograms?.map(
      ({ id, code, name, supportActive, supportLocallyFulfilled, supportStartDate }) => ({
        id,
        code,
        name,
        supportActive,
        supportLocallyFulfilled,
        supportStartDate,
      }),
    ),
  };
}

export async function readAccessSnapshot(readers: AccessReaders, check: () => void) {
  const userId = useLoginData.getState().referenceDataUserId;
  if (!userId) throw new LocalDataUnavailableError();
  check();
  const userAndHome = readers.user(userId).then(async (user) => {
    check();
    if (user.id !== userId) throw new Error('The downloaded user does not match the session.');
    const home = user.homeFacilityId ? await readers.home(user.homeFacilityId) : null;
    check();
    return { user, home };
  });
  const [permissionStrings, programs, { user, home }] = await Promise.all([
    readers.permissions(userId),
    readers.programs(userId),
    userAndHome,
  ]);
  check();
  if (home && home.id !== user.homeFacilityId) {
    throw new Error('The downloaded home facility does not match the user.');
  }
  const snapshot: OfflineAccess = {
    userId,
    permissionStrings: [...permissionStrings],
    user: snapshotUser(user),
    programs: programs.map(({ id, code, name, active }) => ({ id, code, name, active })),
    homeFacility: home ? snapshotHome(home) : null,
    fetchedAt: Date.now(),
    generation: crypto.randomUUID(),
    formatVersion: 1,
  };
  return snapshot;
}

export async function refreshOfflineAccess(readers: AccessReaders, check: () => void) {
  const snapshot = await readAccessSnapshot(readers, check);
  await putOwnedRecord(LOCAL_TABLES.offlineAccess, snapshot, check);
  return snapshot;
}

export const offlineAccessIsStale = (access: OfflineAccess | undefined, now = Date.now()) =>
  !access || now - access.fetchedAt >= OFFLINE_FRESH_FOR;
