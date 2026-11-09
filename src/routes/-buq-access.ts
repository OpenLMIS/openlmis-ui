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
import {
  deploymentTimeZoneOptions,
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

const NO_RIGHTS: readonly string[] = [];

export async function loadBuqAccess(
  queryClient: QueryClient,
  rights: readonly string[],
  cause: 'enter' | 'stay' | 'preload',
  { activeSupport }: { activeSupport: boolean },
): Promise<ShownBuqAccess> {
  const scope = getSessionScope();
  const userId = getSessionUserId();
  if (!userId) throw new SessionEndedError();
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

export async function loadApproveAccess(queryClient: QueryClient) {
  const scope = getSessionScope();
  const userId = getSessionUserId();
  if (!userId) throw new SessionEndedError();
  const [, programs] = await Promise.all([
    requireRight(queryClient, RIGHTS.approveBuq),
    queryClient.ensureQueryData(userProgramsOptions(userId)),
  ]);
  assertSessionScope(scope);
  const access = approveAccess(programs);
  if (access.kind === 'ready') {
    queryClient.prefetchQuery(buqPeriodsOptions());
    queryClient.prefetchQuery(buqApproveStatsOptions(access.program.id));
    queryClient.prefetchQuery(buqsForApprovalOptions(access.program.id));
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
