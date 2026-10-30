import { describe, expect, it } from 'vitest';
import { initiateRows } from '@/features/requisitions/lib/initiate';
import type { InitiatePeriod } from '@/features/requisitions/lib/types';

const january: InitiatePeriod = {
  id: 'jan',
  name: 'January',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
};
const february: InitiatePeriod = {
  id: 'feb',
  name: 'February',
  startDate: '2026-02-01',
  endDate: '2026-02-28',
};
describe('initiateRows', () => {
  it('sorts regular periods, filters before support starts and activates the oldest remaining row', () => {
    const rows = initiateRows([february, january], false, true, '2026-02-01');
    expect(rows).toEqual([{ ...february, action: 'start', status: 'not-started' }]);
    expect(
      initiateRows([february, january], false, true).map((r) => [r.id, r.action, r.status]),
    ).toEqual([
      ['jan', 'start', 'not-started'],
      ['feb', null, 'previous-pending'],
    ]);
  });
  it('opens an existing regular requisition without CREATE and keeps later rows inactive', () => {
    expect(
      initiateRows(
        [{ ...january, requisitionId: 'r', requisitionStatus: 'SUBMITTED' }, february],
        false,
        false,
      ).map((r) => [r.action, r.status]),
    ).toEqual([
      ['open', 'SUBMITTED'],
      [null, 'previous-pending'],
    ]);
    expect(initiateRows([january], false, false)[0]?.action).toBeNull();
  });
  it('keeps old emergency requisitions and repeated periods, activating every row', () => {
    const periods = [
      february,
      { ...january, requisitionId: 'r', requisitionStatus: 'INITIATED' as const },
      january,
    ];
    expect(
      initiateRows(periods, true, true, '2026-02-01').map((r) => [r.action, r.status]),
    ).toEqual([
      ['open', 'INITIATED'],
      ['start', 'not-started'],
      ['start', 'not-started'],
    ]);
    expect(initiateRows(periods, true, false).map((r) => r.action)).toEqual(['open', null, null]);
  });
});
