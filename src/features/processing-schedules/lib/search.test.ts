import { expect, it } from 'vitest';
import {
  periodsSearchSchema,
  toListSearch,
  toPeriodsQuery,
  toScheduleListParams,
  toSchedulesQuery,
} from '@/features/processing-schedules/lib/search';

it('sends the schedule id, one sort and the legacy default orders', () => {
  expect(toPeriodsQuery('s1', { page: 3, size: 20, sort: 'endDate', dir: 'desc' })).toEqual({
    processingScheduleId: 's1',
    page: 2,
    size: 20,
    sort: 'endDate,desc',
  });
  expect(toPeriodsQuery('s1', {}).sort).toBe('startDate,asc');
  expect(toSchedulesQuery({}).sort).toBe('code,asc');
});

it('round trips list state through the periods URL and crumb', () => {
  const list = { page: 3, size: 25, sort: 'name' as const, dir: 'desc' as const };
  const params = toScheduleListParams({ ...list, schedule: 'new' });
  expect(params).toEqual({ listPage: 3, listSize: 25, listSort: 'name', listDir: 'desc' });
  expect(toListSearch(periodsSearchSchema.parse({ ...params, page: 7, period: 'new' }))).toEqual(
    list,
  );
  expect(
    toListSearch(
      periodsSearchSchema.parse({
        listPage: 0,
        listSize: 101,
        listSort: 'endDate',
        listDir: 'up',
      }),
    ),
  ).toEqual({ page: undefined, size: undefined, sort: undefined, dir: undefined });
});
