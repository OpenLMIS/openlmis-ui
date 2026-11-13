import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { buqPeriodsOptions } from '@/features/buq/api/queries';
import type { BuqPeriod } from '@/features/buq/lib/types';

const NO_PERIODS: BuqPeriod[] = [];

export function useBuqPeriods() {
  return useSuspenseQuery(buqPeriodsOptions()).data;
}

export function usePeriodNames() {
  const periods = useQuery(buqPeriodsOptions());
  return periods.isPending ? undefined : (periods.data ?? NO_PERIODS);
}
