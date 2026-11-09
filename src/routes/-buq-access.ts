import type { QueryClient } from '@tanstack/react-query';
import { toDateValue } from '@/components/form/date-value';
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { buqPeriodsOptions, openBuqsOptions } from '@/features/buq/api/queries';
import { type BuqAccess, buqAccess } from '@/features/buq/lib/access';
import {
  deploymentTimeZoneOptions,
  homeFacilityOptions,
  programLookupOptions,
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
    queryClient.prefetchQuery(programLookupOptions(access.program.id));
  }
  return access;
}
