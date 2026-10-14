import type {
  ProcessingPeriod,
  ProcessingPeriodBody,
  ProcessingPeriodsQuery,
  ProcessingScheduleBody,
  ProcessingSchedulesQuery,
} from '@/features/processing-schedules/lib/types';
import type { ProcessingSchedule } from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchProcessingSchedulesPage(query: ProcessingSchedulesQuery) {
  const { data } = await client.get<Page<ProcessingSchedule>>('/processingSchedules', {
    params: query,
  });
  return data;
}

export async function fetchProcessingSchedule(id: string): Promise<ProcessingSchedule> {
  const { data } = await client.get<ProcessingSchedule>(`/processingSchedules/${id}`);
  return data;
}

export async function createProcessingSchedule(
  body: ProcessingScheduleBody,
): Promise<ProcessingSchedule> {
  const { data } = await client.post<ProcessingSchedule>('/processingSchedules', body);
  return data;
}

export async function fetchProcessingPeriodsPage(query: ProcessingPeriodsQuery) {
  const { data } = await client.get<Page<ProcessingPeriod>>('/processingPeriods', {
    params: query,
  });
  return data;
}

export function fetchLatestPeriod(scheduleId: string) {
  return fetchProcessingPeriodsPage({
    processingScheduleId: scheduleId,
    page: 0,
    size: 1,
    sort: 'startDate,desc',
  });
}

export async function createProcessingPeriod(
  body: ProcessingPeriodBody,
): Promise<ProcessingPeriod> {
  const { data } = await client.post<ProcessingPeriod>('/processingPeriods', body);
  return data;
}
