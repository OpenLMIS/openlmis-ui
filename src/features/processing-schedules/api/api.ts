import type {
  ProcessingPeriod,
  ProcessingPeriodBody,
  ProcessingPeriodsQuery,
  ProcessingScheduleBody,
  ProcessingScheduleDetail,
  ProcessingSchedulesQuery,
} from '@/features/processing-schedules/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchProcessingSchedulesPage(query: ProcessingSchedulesQuery) {
  const { data } = await client.get<Page<ProcessingScheduleDetail>>('/processingSchedules', {
    params: query,
  });
  return data;
}

export async function fetchProcessingSchedule(id: string): Promise<ProcessingScheduleDetail> {
  const { data } = await client.get<ProcessingScheduleDetail>(`/processingSchedules/${id}`);
  return data;
}

export async function createProcessingSchedule(
  body: ProcessingScheduleBody,
): Promise<ProcessingScheduleDetail> {
  const { data } = await client.post<ProcessingScheduleDetail>('/processingSchedules', body);
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
