import { describe, expect, it } from 'vitest';
import { adjustmentReasons } from '@/features/reference-data/lib/adjustment-reasons';
import type { Reason, ValidReasonAssignment } from '@/features/reference-data/lib/types';

const reason = (id: string, category = 'ADJUSTMENT', reasonType = 'DEBIT'): Reason => ({
  id,
  name: id,
  reasonCategory: category,
  reasonType,
  isFreeTextAllowed: false,
  tags: [],
});
const assignment = (value: Reason, hidden = false): ValidReasonAssignment => ({
  reason: value,
  hidden,
});

describe('adjustmentReasons', () => {
  it('drops hidden and other categories, keeps both types and server order, dedupes by id', () => {
    const credit = reason('Return', 'ADJUSTMENT', 'CREDIT');
    const damage = reason('Damage');
    const values = [
      assignment(credit),
      assignment(reason('Hidden'), true),
      assignment(reason('Transfer', 'TRANSFER')),
      assignment(damage),
      assignment({ ...damage }),
    ];
    expect(adjustmentReasons(values)).toEqual([credit, damage]);
    expect(values).toHaveLength(5);
  });

  it('does not let a hidden assignment suppress a visible assignment of the same reason', () => {
    const damage = reason('Damage');
    expect(adjustmentReasons([assignment(damage, true), assignment(damage)])).toEqual([damage]);
    expect(adjustmentReasons([])).toEqual([]);
  });
});
