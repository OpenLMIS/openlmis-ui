import { describe, expect, it } from 'vitest';
import { sum, waitingSince } from '@/features/home/lib/requisitions';
import type { RequisitionSummary } from '@/features/home/lib/types';

const requisition = (statusChanges: RequisitionSummary['statusChanges']): RequisitionSummary => ({
  id: 'r',
  emergency: false,
  status: 'IN_APPROVAL',
  createdDate: '2017-01-01T00:00:00Z',
  program: { name: 'Family Planning' },
  facility: { code: 'HC01', name: 'Comfort Health Clinic' },
  processingPeriod: { name: 'Jan2017', startDate: '2017-01-01' },
  statusChanges,
});

describe('waitingSince', () => {
  it('counts from the latest step towards the approver', () => {
    const changes = {
      SUBMITTED: { changeDate: '2017-02-01T00:00:00Z' },
      AUTHORIZED: { changeDate: '2017-02-02T00:00:00Z' },
      IN_APPROVAL: { changeDate: '2017-02-03T00:00:00Z' },
    };
    expect(waitingSince(requisition(changes))).toBe('2017-02-03T00:00:00Z');
    expect(waitingSince(requisition({ ...changes, IN_APPROVAL: undefined }))).toBe(
      '2017-02-02T00:00:00Z',
    );
  });

  it('falls back to when the requisition was created', () => {
    expect(waitingSince(requisition(undefined))).toBe('2017-01-01T00:00:00Z');
  });
});

describe('sum', () => {
  it('adds the counts up', () => {
    expect(sum([380, 0, 364, 396])).toBe(1140);
    expect(sum([])).toBe(0);
  });
});
