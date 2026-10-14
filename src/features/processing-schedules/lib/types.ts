import type { ProcessingSchedule } from '@/features/reference-data/lib/types';

export type ProcessingPeriod = {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  processingSchedule: ProcessingSchedule;
  extraData?: Record<string, unknown> | null;
};

export type ProcessingSchedulesQuery = {
  page: number;
  size: number;
  sort: string;
};

export type ProcessingPeriodsQuery = ProcessingSchedulesQuery & {
  processingScheduleId: string;
};

export type ProcessingScheduleBody = Omit<ProcessingSchedule, 'id'>;

export type ProcessingPeriodBody = Omit<ProcessingPeriod, 'id'>;
