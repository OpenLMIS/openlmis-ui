import { describe, expect, it } from 'vitest';
import { showsYear, totalsByMonth } from '@/features/home/lib/periods';
import type { RequisitionStatus, RequisitionSummary } from '@/features/home/lib/types';

const requisition = (
  status: RequisitionStatus,
  startDate: string,
  name = startDate,
): RequisitionSummary => ({
  id: `${status}-${name}`,
  emergency: false,
  status,
  createdDate: '2018-01-01T00:00:00Z',
  program: { name: 'Family Planning' },
  facility: { code: 'HC01', name: 'Comfort Health Clinic' },
  processingPeriod: { name, startDate },
});

describe('totalsByMonth', () => {
  it('counts in-progress and approved requisitions by the month their period starts', () => {
    const totals = totalsByMonth([
      requisition('APPROVED', '2017-02-01'),
      requisition('SUBMITTED', '2017-02-01'),
      requisition('RELEASED', '2017-01-01'),
    ]);

    expect(totals).toEqual([
      { month: '2017-01', inProgress: 0, approved: 1 },
      { month: '2017-02', inProgress: 1, approved: 1 },
    ]);
  });

  it('puts a quarter in the month it starts, beside the monthly period of that month', () => {
    const totals = totalsByMonth([
      requisition('SUBMITTED', '2017-04-01', 'Apr2017'),
      requisition('APPROVED', '2017-04-01', '2017Q2'),
    ]);

    expect(totals).toEqual([{ month: '2017-04', inProgress: 1, approved: 1 }]);
  });

  it('leaves out drafts, rejections and skipped periods', () => {
    expect(
      totalsByMonth([
        requisition('INITIATED', '2017-01-01'),
        requisition('REJECTED', '2017-01-01'),
        requisition('SKIPPED', '2017-01-01'),
      ]),
    ).toEqual([]);
  });

  it('keeps only the latest months', () => {
    const totals = totalsByMonth(
      ['2017-01-01', '2017-02-01', '2017-03-01'].map((date) => requisition('APPROVED', date)),
      2,
    );
    expect(totals.map(({ month }) => month)).toEqual(['2017-02', '2017-03']);
  });
});

describe('showsYear', () => {
  it('shows the year on the first month and where it changes', () => {
    const months = ['2017-11', '2017-12', '2018-01', '2018-02'].map((month) => ({
      month,
      inProgress: 0,
      approved: 1,
    }));
    expect(months.map((_, index) => showsYear(months, index))).toEqual([true, false, true, false]);
  });
});
