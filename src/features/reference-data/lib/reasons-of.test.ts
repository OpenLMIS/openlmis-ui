import { describe, expect, it } from 'vitest';
import { reasonsOf } from '@/features/reference-data/lib/reasons-of';
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

describe('reasonsOf', () => {
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
    expect(reasonsOf(values, 'ADJUSTMENT')).toEqual([credit, damage]);
    expect(values).toHaveLength(5);
  });

  it('does not let a hidden assignment suppress a visible assignment of the same reason', () => {
    const damage = reason('Damage');
    expect(reasonsOf([assignment(damage, true), assignment(damage)], 'ADJUSTMENT')).toEqual([
      damage,
    ]);
    expect(reasonsOf([], 'ADJUSTMENT')).toEqual([]);
  });
});

describe('reasonsOf', () => {
  it('keeps only visible debit transfers, deduped in server order', () => {
    const first = reason('first', 'TRANSFER');
    const second = reason('second', 'TRANSFER');
    const assignments = [
      assignment(first, true),
      assignment(reason('adjustment', 'ADJUSTMENT', 'DEBIT')),
      assignment(reason('credit', 'TRANSFER', 'CREDIT')),
      assignment(first),
      assignment(second),
      assignment(first),
    ];
    expect(reasonsOf(assignments, 'TRANSFER', 'DEBIT')).toEqual([first, second]);
    expect(assignments).toHaveLength(6);
  });
  it('filters credit transfers for Receive and handles no assignments', () => {
    const credit = reason('credit', 'TRANSFER', 'CREDIT');
    expect(
      reasonsOf([assignment(reason('debit')), assignment(credit)], 'TRANSFER', 'CREDIT'),
    ).toEqual([credit]);
    expect(reasonsOf([], 'TRANSFER', 'DEBIT')).toEqual([]);
  });
});
