import { queryOptions } from '@tanstack/react-query';
import { fetchBuqPeriods, fetchPreparedBuqs } from '@/features/buq/api/api';
import type { BuqPeriod } from '@/features/buq/lib/types';
import { queryKeys } from '@/lib/key-factory';

const NO_PERIODS: BuqPeriod[] = [];

export const preparedBuqsOptions = (facilityId: string) =>
  queryOptions({
    queryKey: queryKeys.buq.list({ facility: facilityId }),
    queryFn: () => fetchPreparedBuqs(facilityId),
  });

export const buqPeriodsOptions = (scheduleId: string | undefined) =>
  queryOptions({
    queryKey: [...queryKeys.buq.all, 'periods', scheduleId],
    queryFn: () => (scheduleId ? fetchBuqPeriods(scheduleId) : NO_PERIODS),
  });
