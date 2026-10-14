import { z } from 'zod';
import type {
  ProcessingPeriodsQuery,
  ProcessingSchedulesQuery,
} from '@/features/processing-schedules/lib/types';
import {
  type DefaultSort,
  tableSearchSchema,
  toPaginationState,
  toSortParam,
} from '@/lib/table-search';

export const PERIOD_HIDEABLE_COLUMNS = [
  { id: 'description', labelKey: 'processing-schedules.description', hideBelow: 'lg' },
  { id: 'startDate', labelKey: 'processing-schedules.periods.start-date' },
  { id: 'endDate', labelKey: 'processing-schedules.periods.end-date' },
  { id: 'reportOnly', labelKey: 'processing-schedules.periods.report-only', hideBelow: 'md' },
] as const;

export const DEFAULT_SCHEDULES_SORT: DefaultSort = { id: 'code', desc: false };
export const DEFAULT_PERIODS_SORT: DefaultSort = { id: 'startDate', desc: false };

const schedulesTableSchema = tableSearchSchema(['code', 'name']);

export const schedulesSearchSchema = schedulesTableSchema.extend({
  schedule: z.literal('new').optional().catch(undefined),
});

export const periodsSearchSchema = tableSearchSchema(['startDate', 'endDate']).extend({
  period: z.literal('new').optional().catch(undefined),
  listPage: schedulesTableSchema.shape.page,
  listSize: schedulesTableSchema.shape.size,
  listSort: schedulesTableSchema.shape.sort,
  listDir: schedulesTableSchema.shape.dir,
});

export type SchedulesSearch = z.infer<typeof schedulesSearchSchema>;
export type PeriodsSearch = z.infer<typeof periodsSearchSchema>;

export function toSchedulesQuery(search: SchedulesSearch): ProcessingSchedulesQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return { page: pageIndex, size: pageSize, sort: toSortParam(search, DEFAULT_SCHEDULES_SORT) };
}

export function toPeriodsQuery(scheduleId: string, search: PeriodsSearch): ProcessingPeriodsQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    processingScheduleId: scheduleId,
    page: pageIndex,
    size: pageSize,
    sort: toSortParam(search, DEFAULT_PERIODS_SORT),
  };
}

export function toScheduleListParams(search: SchedulesSearch) {
  return {
    listPage: search.page,
    listSize: search.size,
    listSort: search.sort,
    listDir: search.dir,
  };
}

export function toListSearch(search: PeriodsSearch): SchedulesSearch {
  return {
    page: search.listPage,
    size: search.listSize,
    sort: search.listSort,
    dir: search.listDir,
  };
}
