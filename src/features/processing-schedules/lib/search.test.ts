import { expect, it } from 'vitest';
import {
  schedulesSearchSchema,
  toPeriodsQuery,
  toSchedulesQuery,
} from '@/features/processing-schedules/lib/search';

it('sends the schedule id, pagination and ascending period order', () => {
  expect(toPeriodsQuery('s1', { periodsPage: 3 })).toEqual({
    processingScheduleId: 's1',
    page: 2,
    size: 10,
    sort: 'startDate,asc',
  });
  expect(toPeriodsQuery('s1', {}).sort).toBe('startDate,asc');
  expect(toSchedulesQuery({}).sort).toBe('code,asc');
});

it('drops malformed periods ids without changing schedule list state', () => {
  expect(
    schedulesSearchSchema.parse({ periods: 'bad', page: 3, size: 25, sort: 'name', dir: 'desc' }),
  ).toMatchObject({ periods: undefined, page: 3, size: 25, sort: 'name', dir: 'desc' });
  const periods = '00000000-0000-4000-8000-000000000001';
  expect(schedulesSearchSchema.parse({ periods, periodsPage: 2 })).toMatchObject({
    periods,
    periodsPage: 2,
  });
});
