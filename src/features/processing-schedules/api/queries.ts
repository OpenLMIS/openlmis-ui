import { queryOptions } from '@tanstack/react-query';
import {
  fetchLatestPeriod,
  fetchProcessingPeriodsPage,
  fetchProcessingSchedule,
  fetchProcessingSchedulesPage,
} from '@/features/processing-schedules/api/api';
import type {
  ProcessingPeriodsQuery,
  ProcessingSchedulesQuery,
} from '@/features/processing-schedules/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const schedulesListOptions = (query: ProcessingSchedulesQuery) =>
  queryOptions({
    queryKey: queryKeys.processingSchedules.list(query),
    queryFn: () => fetchProcessingSchedulesPage(query),
  });

export const scheduleDetailOptions = (id: string, opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.processingSchedules.detail(id), opening] as const,
    queryFn: () => fetchProcessingSchedule(id),
  });

export const periodsListOptions = (query: ProcessingPeriodsQuery) =>
  queryOptions({
    queryKey: queryKeys.processingPeriods.list(query),
    queryFn: () => fetchProcessingPeriodsPage(query),
  });

export const latestPeriodOptions = (scheduleId: string, opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.processingPeriods.all, 'latest', scheduleId, opening] as const,
    queryFn: () => fetchLatestPeriod(scheduleId),
  });
