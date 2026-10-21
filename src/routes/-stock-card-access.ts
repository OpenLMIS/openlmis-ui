import type { QueryClient } from '@tanstack/react-query';
import { requirePermissions } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  homeFacilityOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { isDeviceAccess } from '@/lib/offline-access';
import { RIGHTS } from '@/lib/rights';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export async function stockCardAccess(queryClient: QueryClient) {
  const scope = getSessionScope();
  const userId = useLoginData.getState().referenceDataUserId;
  if (!userId) throw new LocalDataUnavailableError();
  const [permissions, user, programs] = await Promise.all([
    requirePermissions(queryClient, RIGHTS.stockCardsView),
    queryClient.fetchQuery(userRecordOptions(userId)),
    queryClient.fetchQuery(userProgramsOptions(userId)),
  ]);
  assertSessionScope(scope);
  const homeFacility = user.homeFacilityId
    ? await queryClient.fetchQuery(homeFacilityOptions(user.homeFacilityId))
    : null;
  assertSessionScope(scope);
  if (
    isDeviceAccess(permissions) ||
    isDeviceAccess(user) ||
    isDeviceAccess(programs) ||
    isDeviceAccess(homeFacility)
  )
    throw new LocalDataUnavailableError();
  return {
    homeFacility,
    programs,
    permissionStrings: permissions.grants.map(
      (grant) => `${grant.right}|${grant.facilityId}|${grant.programId}`,
    ),
  };
}
