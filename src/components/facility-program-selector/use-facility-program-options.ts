import { type QueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  minimalFacilitiesOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { facilityProgramOptions } from '@/lib/facility-program-selection';
import type { ProgramGrant } from '@/lib/permissions';

const sourceQueries = (userId: string) =>
  [userRecordOptions(userId), userProgramsOptions(userId), minimalFacilitiesOptions()] as const;

/** The picker's options for one right, from the same four reads legacy makes; suspends until they load. */
export function useFacilityProgramOptions(userId: string, grants: readonly ProgramGrant[]) {
  const [user, programs, facilities] = useSuspenseQueries({ queries: sourceQueries(userId) });
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

/** Starts the picker's reads without waiting; a failed one shows in the picker with a retry. */
export function prefetchFacilityProgramOptions(queryClient: QueryClient, userId: string) {
  const [user, programs, facilities] = sourceQueries(userId);
  queryClient.prefetchQuery(user);
  queryClient.prefetchQuery(programs);
  queryClient.prefetchQuery(facilities);
}
