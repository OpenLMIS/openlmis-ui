import type { QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toDateValue } from '@/components/form/date-value';
import { ForbiddenError, requirePermissions, requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import {
  buqApproveStatsOptions,
  buqPeriodsOptions,
  buqsForApprovalOptions,
  openBuqsOptions,
} from '@/features/buq/api/queries';
import { approveAccess, type BuqAccess, buqAccess } from '@/features/buq/lib/access';
import { approvalFacilityIds } from '@/features/buq/lib/approval-rows';
import {
  deploymentTimeZoneOptions,
  facilitiesByIdsOptions,
  homeFacilityOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import {
  assertSessionScope,
  getSessionScope,
  getSessionUserId,
  SessionEndedError,
} from '@/lib/session-scope';

type ShownBuqAccess = Exclude<BuqAccess, { kind: 'no-grant' }>;

const noop = () => {};
const NO_RIGHTS: readonly string[] = [];

function currentUser() {
  const scope = getSessionScope();
  const userId = getSessionUserId();
  if (!userId) throw new SessionEndedError();
  return { scope, userId };
}

export async function loadBuqAccess(
  queryClient: QueryClient,
  rights: readonly string[],
  cause: 'enter' | 'stay' | 'preload',
  { activeSupport }: { activeSupport: boolean },
): Promise<ShownBuqAccess> {
  const { scope, userId } = currentUser();
  const fresh = cause === 'enter' ? { staleTime: 0 } : {};
  const [permissions, user, programs, timeZone] = await Promise.all([
    requirePermissions(queryClient, rights),
    queryClient.fetchQuery({ ...userRecordOptions(userId), ...fresh }),
    queryClient.fetchQuery({ ...userProgramsOptions(userId), ...fresh }),
    activeSupport ? queryClient.fetchQuery(deploymentTimeZoneOptions()) : undefined,
  ]);
  assertSessionScope(scope);
  const home = user.homeFacilityId
    ? await queryClient.fetchQuery({ ...homeFacilityOptions(user.homeFacilityId), ...fresh })
    : undefined;
  assertSessionScope(scope);
  const access = buqAccess({
    home,
    programs,
    permissions,
    rights,
    support: timeZone ? { activeOn: toDateValue(new Date(), timeZone.zone) } : 'listed',
  });
  if (access.kind === 'no-grant') throw new ForbiddenError(rights);
  if (access.kind === 'ready') {
    queryClient.prefetchQuery(buqPeriodsOptions());
    queryClient.prefetchQuery(openBuqsOptions(access.facility.id));
  }
  return access;
}

export async function loadApproveAccess(
  queryClient: QueryClient,
  cause: 'enter' | 'stay' | 'preload',
) {
  const { scope, userId } = currentUser();
  const fresh = cause === 'enter' ? { staleTime: 0 } : {};
  const [, programs] = await Promise.all([
    requireRight(queryClient, RIGHTS.approveBuq),
    queryClient.fetchQuery({ ...userProgramsOptions(userId), ...fresh }),
  ]);
  assertSessionScope(scope);
  const access = approveAccess(programs);
  if (access.kind === 'ready') {
    queryClient.prefetchQuery(buqPeriodsOptions());
    queryClient.prefetchQuery(buqApproveStatsOptions(access.programId));
    void queryClient
      .fetchQuery(buqsForApprovalOptions(access.programId))
      .then((buqs) => {
        assertSessionScope(scope);
        return queryClient.prefetchQuery(facilitiesByIdsOptions(approvalFacilityIds(buqs)));
      })
      .catch(noop);
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
  }
  return access;
}

export function useForecastRights(access: ShownBuqAccess) {
  const granted = access.kind === 'ready' ? access.granted : NO_RIGHTS;
  return useMemo(
    () => ({
      create: granted.includes(RIGHTS.createForecasting),
      authorize: granted.includes(RIGHTS.authorizeForecasting),
    }),
    [granted],
  );
}
