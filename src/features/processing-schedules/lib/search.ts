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

export const DEFAULT_SCHEDULES_SORT: DefaultSort = { id: 'code', desc: false };

export const PERIODS_PAGE_SIZE = 10;

const schedulesTableSchema = tableSearchSchema(['code', 'name']);

export const schedulesSearchSchema = schedulesTableSchema.extend({
  schedule: z.literal('new').optional().catch(undefined),
  periods: z.guid().optional().catch(undefined),
  periodsPage: schedulesTableSchema.shape.page,
});

export type SchedulesSearch = z.infer<typeof schedulesSearchSchema>;

export function toSchedulesQuery(search: SchedulesSearch): ProcessingSchedulesQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return { page: pageIndex, size: pageSize, sort: toSortParam(search, DEFAULT_SCHEDULES_SORT) };
}

export function toPeriodsQuery(
  scheduleId: string,
  search: SchedulesSearch,
): ProcessingPeriodsQuery {
  const { pageIndex } = toPaginationState({ page: search.periodsPage });
  return {
    processingScheduleId: scheduleId,
    page: pageIndex,
    size: PERIODS_PAGE_SIZE,
    sort: 'startDate,asc',
  };
}
