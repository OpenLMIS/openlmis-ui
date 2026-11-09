import type { QueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { buqPeriodsOptions, preparedBuqsOptions } from '@/features/buq/api/queries';
import { BUQ_CODE, type BuqAccess, buqAccess } from '@/features/buq/lib/access';
import {
  homeFacilityOptions,
  processingSchedulesOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

type ShownBuqAccess = Exclude<BuqAccess, { kind: 'no-grant' }>;

const noop = () => {};

export async function loadBuqAccess(
  queryClient: QueryClient,
  rights: readonly string[],
  cause: 'enter' | 'stay' | 'preload',
): Promise<ShownBuqAccess> {
  const scope = getSessionScope();
  const userId = useLoginData.getState().referenceDataUserId;
  if (!userId) throw new ForbiddenError(rights);
  const fresh = cause === 'enter' ? { staleTime: 0 } : {};
  const [permissions, user, programs] = await Promise.all([
    requirePermissions(queryClient, rights),
    queryClient.fetchQuery({ ...userRecordOptions(userId), ...fresh }),
    queryClient.fetchQuery({ ...userProgramsOptions(userId), ...fresh }),
  ]);
  if (useLoginData.getState().referenceDataUserId !== userId) throw new ForbiddenError(rights);
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
    if (cause !== 'preload') queryClient.prefetchQuery(preparedBuqsOptions(access.facility.id));
  }
  return access;
}
