import type { QueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { buqPeriodsOptions, openBuqsOptions } from '@/features/buq/api/queries';
import { BUQ_CODE, type BuqAccess, buqAccess } from '@/features/buq/lib/access';
import {
  homeFacilityOptions,
  processingSchedulesOptions,
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

export async function loadBuqAccess(
  queryClient: QueryClient,
  rights: readonly string[],
  cause: 'enter' | 'stay' | 'preload',
): Promise<ShownBuqAccess> {
  const scope = getSessionScope();
  const userId = getSessionUserId();
  if (!userId) throw new SessionEndedError();
  const fresh = cause === 'enter' ? { staleTime: 0 } : {};
  const [permissions, user, programs] = await Promise.all([
    requirePermissions(queryClient, rights),
    queryClient.fetchQuery({ ...userRecordOptions(userId), ...fresh }),
    queryClient.fetchQuery({ ...userProgramsOptions(userId), ...fresh }),
  ]);
  const home = user.homeFacilityId
    ? await queryClient.fetchQuery({ ...homeFacilityOptions(user.homeFacilityId), ...fresh })
    : undefined;
  assertSessionScope(scope);
  const access = buqAccess({
    home,
    programs,
    permissions,
    rights,
    today: format(new Date(), 'yyyy-MM-dd'),
  });
  if (access.kind === 'no-grant') throw new ForbiddenError(rights);
  if (access.kind === 'ready') {
    void queryClient.fetchQuery(processingSchedulesOptions()).then((schedules) => {
      const schedule = schedules.find(({ code }) => code === BUQ_CODE);
      return queryClient.prefetchQuery(buqPeriodsOptions(schedule?.id));
    }, noop);
    if (cause !== 'preload') queryClient.prefetchQuery(openBuqsOptions(access.facility.id));
  }
  return access;
}
