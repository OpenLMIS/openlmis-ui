import { expect, it } from 'vitest';
import { facilityCceStatus } from '@/features/cce-inventory/lib/facility-cce-status';

it('distinguishes unknown, no equipment, all, some and no functioning equipment', () => {
  expect(facilityCceStatus(undefined)).toBe('unknown');
  expect(facilityCceStatus([])).toBe('no-cce');
  expect(facilityCceStatus([{ functionalStatus: 'FUNCTIONING' }])).toBe('all-functioning');
  expect(
    facilityCceStatus([
      { functionalStatus: 'FUNCTIONING' },
      { functionalStatus: 'NEEDS_ATTENTION' },
    ]),
  ).toBe('not-fully-functioning');
  expect(
    facilityCceStatus([
      { functionalStatus: 'AWAITING_REPAIR' },
      { functionalStatus: 'UNSERVICEABLE' },
    ]),
  ).toBe('not-functioning');
  expect(facilityCceStatus([{ functionalStatus: null }])).toBe('unknown');
});
