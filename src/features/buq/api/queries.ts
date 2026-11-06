import { queryOptions } from '@tanstack/react-query';
import { fetchBuqPeriods, fetchPreparedBuqs } from '@/features/buq/api/api';
import { queryKeys } from '@/lib/key-factory';

export const preparedBuqsOptions = (facilityId: string) =>
  queryOptions({
    queryKey: queryKeys.buq.list({ facility: facilityId }),
    queryFn: () => fetchPreparedBuqs(facilityId),
  });

export const buqPeriodsOptions = (scheduleId: string) =>
  queryOptions({
    queryKey: [...queryKeys.buq.all, 'periods', scheduleId],
    queryFn: () => fetchBuqPeriods(scheduleId),
  });
