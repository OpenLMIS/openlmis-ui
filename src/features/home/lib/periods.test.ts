import { describe, expect, it } from 'vitest';
import { totalsByPeriod } from '@/features/home/lib/periods';
import type { RequisitionStatus, RequisitionSummary } from '@/features/home/lib/types';

const requisition = (status: RequisitionStatus, month: number): RequisitionSummary => ({
  id: `${status}-${month}`,
  emergency: false,
  status,
  createdDate: '2018-01-01T00:00:00Z',
  program: { id: 'p', name: 'Family Planning' },
  facility: { id: 'f', code: 'HC01', name: 'Comfort Health Clinic' },
  processingPeriod: {
    id: `period-${month}`,
    name: `Month ${month}`,
    startDate: `2017-${String(month).padStart(2, '0')}-01`,
  },
});

describe('totalsByPeriod', () => {
  it('counts in-progress and approved requisitions per period, oldest first', () => {
    const totals = totalsByPeriod([
      requisition('APPROVED', 2),
      requisition('SUBMITTED', 2),
      requisition('RELEASED', 1),
      requisition('IN_APPROVAL', 2),
    ]);

    expect(totals.map(({ name, inProgress, approved }) => [name, inProgress, approved])).toEqual([
      ['Month 1', 0, 1],
      ['Month 2', 2, 1],
    ]);
  });

  it('leaves out drafts, rejections and skipped periods', () => {
    expect(
      totalsByPeriod([
        requisition('INITIATED', 1),
        requisition('REJECTED', 1),
        requisition('SKIPPED', 1),
      ]),
    ).toEqual([]);
  });

  it('keeps only the most recent periods', () => {
    const totals = totalsByPeriod(
      [1, 2, 3, 4].map((month) => requisition('APPROVED', month)),
      2,
    );
    expect(totals.map(({ name }) => name)).toEqual(['Month 3', 'Month 4']);
  });
});
