import { expect, it } from 'vitest';
import { buqRows, quantificationYears } from '@/features/buq/lib/rows';
import type { Buq, BuqPeriod } from '@/features/buq/lib/types';

const PERIODS: BuqPeriod[] = [
  { id: 'p17', name: 'July 2017 - June 2018', startDate: '2017-07-01', endDate: '2018-06-30' },
  { id: 'p16', name: 'July 2016 - June 2017', startDate: '2016-07-01', endDate: '2017-06-30' },
];

const buq = (id: string, processingPeriodId: string, targetYear: number): Buq => ({
  id,
  facilityId: 'f1',
  programId: 'g1',
  processingPeriodId,
  targetYear,
  status: 'DRAFT',
});

it('names each forecast by its period and lists them by period start', () => {
  const rows = buqRows([buq('b17', 'p17', 2018), buq('b16', 'p16', 2018)], PERIODS);

  expect(rows.map(({ id, periodName }) => [id, periodName])).toEqual([
    ['b16', 'July 2016 - June 2017'],
    ['b17', 'July 2017 - June 2018'],
  ]);
});

it('lists an earlier target year first, whatever its period', () => {
  const rows = buqRows([buq('b16', 'p16', 2019), buq('b17', 'p17', 2018)], PERIODS);

  expect(rows.map(({ id }) => id)).toEqual(['b17', 'b16']);
});

it('quantifies the two years after the target year, as legacy', () => {
  expect(quantificationYears(2018)).toBe('2019/2020');
});
