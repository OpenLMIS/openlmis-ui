import { expect, it } from 'vitest';
import {
  isReportOnly,
  landingPage,
  nextStartDate,
  periodFormSchema,
  previousDate,
  toPeriodBody,
} from '@/features/processing-schedules/lib/period-form';

const schedule = { id: 's1', code: 'M', name: 'Monthly', modifiedDate: '2026-01-01' };
const valid = {
  name: ' January ',
  description: ' ',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  reportOnly: false,
};

it.each([true, 'true', false, 'false', 1, undefined])('reads Report Only %s strictly', (value) => {
  expect(isReportOnly({ reportOnly: value })).toBe(value === true || value === 'true');
});

it.each([
  ['2026-01-31', '2026-02-01'],
  ['2025-12-31', '2026-01-01'],
  ['2024-02-28', '2024-02-29'],
  ['2024-02-29', '2024-03-01'],
])('moves calendar dates from %s to %s', (end, next) => {
  expect(nextStartDate(end)).toBe(next);
  expect(previousDate(next)).toBe(end);
});

it.each(['2026-01-01', '2025-12-31'])('refuses an end on or before the start: %s', (endDate) => {
  const result = periodFormSchema.safeParse({ ...valid, endDate });
  expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
    ['endDate', 'processing-schedules.period-form.end-after-start'],
  ]);
});

it('sends the loaded schedule and trimmed text, with extraData only when on', () => {
  const body = toPeriodBody(valid, schedule);
  expect(body).toEqual({
    processingSchedule: schedule,
    name: 'January',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  });
  expect(
    toPeriodBody({ ...valid, reportOnly: true, description: ' Reporting ' }, schedule),
  ).toEqual({
    ...body,
    description: 'Reporting',
    extraData: { reportOnly: true },
  });
});

it.each([
  [0, 10, 1],
  [10, 10, 1],
  [11, 10, 2],
  [11, 4, 3],
])('lands %i periods with size %i on ascending page %i', (total, size, page) => {
  expect(landingPage({ total, size })).toBe(page);
});
