import { queryOptions } from '@tanstack/react-query';
import {
  fetchApproveStats,
  fetchBuqForecast,
  fetchBuqPeriods,
  fetchBuqsForApproval,
  fetchMostRecentRejection,
  fetchOpenBuqs,
  fetchRemarks,
  fetchSourcesOfFunds,
  fetchTakenPeriods,
} from '@/features/buq/api/api';
import { BUQ_CODE } from '@/features/buq/lib/access';
import type { BuqPeriod } from '@/features/buq/lib/types';
import {
  LOOKUP_STALE_TIME,
  processingSchedulesOptions,
} from '@/features/reference-data/api/queries';
import { queryKeys } from '@/lib/key-factory';

const NO_PERIODS: BuqPeriod[] = [];

export const openBuqsOptions = (facilityId: string) =>
  queryOptions({
    queryKey: queryKeys.buq.list({ facility: facilityId }),
    queryFn: () => fetchOpenBuqs(facilityId),
  });

export const takenPeriodsOptions = (facilityId: string) =>
  queryOptions({
    queryKey: queryKeys.buq.list({ facility: facilityId, every: true }),
    queryFn: () => fetchTakenPeriods(facilityId),
  });

export const buqsForApprovalOptions = (programId: string) =>
  queryOptions({
    queryKey: queryKeys.buq.list({ approve: programId }),
    queryFn: () => fetchBuqsForApproval(programId),
  });

export const buqApproveStatsOptions = (programId: string) =>
  queryOptions({
    queryKey: [...queryKeys.buq.all, 'approve-stats', programId],
    queryFn: () => fetchApproveStats(programId),
  });

export const buqPeriodsOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.processingPeriods.all, 'buq'],
    queryFn: async ({ client }) => {
      const schedules = await client.fetchQuery(processingSchedulesOptions());
      const schedule = schedules.find(({ code }) => code === BUQ_CODE);
      return schedule ? fetchBuqPeriods(schedule.id) : NO_PERIODS;
    },
    staleTime: LOOKUP_STALE_TIME,
  });

export const buqForecastOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.buq.detail(id),
    queryFn: () => fetchBuqForecast(id),
  });

export const buqRemarksOptions = () =>
  queryOptions({ queryKey: [...queryKeys.buq.all, 'remarks'], queryFn: fetchRemarks });

export const buqSourcesOfFundsOptions = () =>
  queryOptions({ queryKey: [...queryKeys.buq.all, 'sources'], queryFn: fetchSourcesOfFunds });

export const buqRejectionOptions = (id: string) =>
  queryOptions({
    queryKey: [...queryKeys.buq.detail(id), 'rejection'],
    queryFn: () => fetchMostRecentRejection(id),
  });
