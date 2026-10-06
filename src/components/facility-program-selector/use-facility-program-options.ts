import { type QueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  minimalFacilitiesOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { facilityProgramOptions } from '@/lib/facility-program-selection';
import type { ProgramGrant } from '@/lib/permissions';

/** The picker's options for one right, from the same four reads legacy makes; suspends until they load. */
export function useFacilityProgramOptions(userId: string, grants: readonly ProgramGrant[]) {
  const [user, programs, facilities] = useSuspenseQueries({
    queries: [userRecordOptions(userId), userProgramsOptions(userId), minimalFacilitiesOptions()],
  });
  return useMemo(
    () =>
      facilityProgramOptions({
        homeFacilityId: user.data.homeFacilityId,
        programs: programs.data,
        facilities: facilities.data,
        grants,
      }),
    [user.data.homeFacilityId, programs.data, facilities.data, grants],
  );
}

export async function loadFacilityProgramOptions(
  queryClient: QueryClient,
  userId: string,
  grants: readonly ProgramGrant[],
) {
  const [user, programs, facilities] = await Promise.all([
    queryClient.ensureQueryData(userRecordOptions(userId)),
    queryClient.ensureQueryData(userProgramsOptions(userId)),
    queryClient.ensureQueryData(minimalFacilitiesOptions()),
  ]);
  return facilityProgramOptions({
    homeFacilityId: user.homeFacilityId,
    programs,
    facilities,
    grants,
  });
}
