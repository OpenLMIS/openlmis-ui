import { useSuspenseQuery } from '@tanstack/react-query';
import { buqPeriodsOptions } from '@/features/buq/api/queries';
import { BUQ_CODE } from '@/features/buq/lib/access';
import { processingSchedulesOptions } from '@/features/reference-data/api/queries';

export function useBuqPeriods() {
  const { data: schedules } = useSuspenseQuery(processingSchedulesOptions());
  const schedule = schedules.find(({ code }) => code === BUQ_CODE);
  return useSuspenseQuery(buqPeriodsOptions(schedule?.id)).data;
}
