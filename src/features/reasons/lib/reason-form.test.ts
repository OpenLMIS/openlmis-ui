import { describe, expect, it } from 'vitest';
import {
  addPairSchema,
  diffPairs,
  EMPTY_REASON_FORM,
  reasonFormSchema,
  toReasonBody,
  toReasonFormValues,
} from '@/features/reasons/lib/reason-form';
import type { ValidReason } from '@/features/reasons/lib/types';
import type { Reason } from '@/features/reference-data/lib/types';

const damage: Reason = {
  id: 'r1',
  name: 'Damage',
  description: 'Broken in transit',
  reasonType: 'DEBIT',
  reasonCategory: 'ADJUSTMENT',
  isFreeTextAllowed: false,
  tags: ['adjustment'],
};
const transfer: Reason = { ...damage, id: 'r2', name: 'Transfer In', description: null };

const valid = (
  id: string,
  programId: string,
  facilityTypeId: string,
  hidden = false,
): ValidReason => ({
  id,
  program: { id: programId },
  facilityType: { id: facilityTypeId },
  hidden,
  reason: { id: 'r1' },
});

const issues = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('reasonFormSchema', () => {
  const values = { ...EMPTY_REASON_FORM, name: 'Expired', category: 'ADJUSTMENT', type: 'DEBIT' };

  it('takes a filled-in form', () => {
    expect(reasonFormSchema([damage]).safeParse(values).success).toBe(true);
  });

  it('asks for a name, a category and a type', () => {
    expect(issues(reasonFormSchema([]).safeParse({ ...EMPTY_REASON_FORM, name: '   ' }))).toEqual([
      'reasons.form.name-required',
      'reasons.form.category-required',
      'reasons.form.type-required',
    ]);
  });

  it("refuses another reason's name, whatever its case or spaces", () => {
    expect(issues(reasonFormSchema([damage]).safeParse({ ...values, name: ' DAMAGE ' }))).toEqual([
      'reasons.form.name-duplicate',
    ]);
  });

  it("keeps the reason's own name on edit", () => {
    expect(reasonFormSchema([damage], 'r1').safeParse({ ...values, name: 'Damage' }).success).toBe(
      true,
    );
  });

  it('refuses a name the server refused, even if the list has not caught up', () => {
    expect(
      issues(reasonFormSchema([], undefined, ['Lost']).safeParse({ ...values, name: 'Lost' })),
    ).toEqual(['reasons.form.name-duplicate']);
  });
});

describe('addPairSchema', () => {
  const rows = [{ programId: 'p1', facilityTypeId: 't1', show: true }];

  it('asks for a program and a facility type', () => {
    expect(
      issues(addPairSchema(rows).safeParse({ programId: '', facilityTypeId: '', show: true })),
    ).toEqual(['reasons.form.program-required', 'reasons.form.facility-type-required']);
  });

  it('refuses a pair already listed, whatever its Show', () => {
    expect(
      issues(addPairSchema(rows).safeParse({ programId: 'p1', facilityTypeId: 't1', show: false })),
    ).toEqual(['reasons.form.pair-duplicate']);
    expect(
      addPairSchema(rows).safeParse({ programId: 'p1', facilityTypeId: 't2', show: true }).success,
    ).toBe(true);
  });
});

describe('toReasonFormValues', () => {
  it('fills the form with the reason and its pairs, Show being the opposite of hidden', () => {
    expect(toReasonFormValues(damage, [valid('v1', 'p1', 't1', true)])).toEqual({
      name: 'Damage',
      category: 'ADJUSTMENT',
      type: 'DEBIT',
      isFreeTextAllowed: false,
      tags: ['adjustment'],
      pairs: [{ programId: 'p1', facilityTypeId: 't1', show: false }],
    });
  });
});

describe('toReasonBody', () => {
  const values = {
    ...EMPTY_REASON_FORM,
    name: '  Expired ',
    category: 'ADJUSTMENT',
    type: 'DEBIT',
    isFreeTextAllowed: true,
    tags: ['expired'],
  };

  it('sends a new reason with the trimmed name', () => {
    expect(toReasonBody(values)).toEqual({
      name: 'Expired',
      reasonCategory: 'ADJUSTMENT',
      reasonType: 'DEBIT',
      isFreeTextAllowed: true,
      tags: ['expired'],
    });
  });

  it('keeps what the form does not show, such as the description, on edit', () => {
    expect(toReasonBody(values, damage)).toEqual({
      id: 'r1',
      name: 'Expired',
      description: 'Broken in transit',
      reasonCategory: 'ADJUSTMENT',
      reasonType: 'DEBIT',
      isFreeTextAllowed: true,
      tags: ['expired'],
    });
  });

  it('never changes the stored category or type on edit, which the server refuses', () => {
    expect(
      toReasonBody({ ...values, category: 'TRANSFER', type: 'CREDIT' }, transfer),
    ).toMatchObject({
      reasonCategory: 'ADJUSTMENT',
      reasonType: 'DEBIT',
    });
  });
});

describe('diffPairs', () => {
  const saved = [valid('v1', 'p1', 't1'), valid('v2', 'p1', 't2', true), valid('v3', 'p2', 't1')];

  it('sends nothing when nothing changed', () => {
    const draft = [
      { programId: 'p1', facilityTypeId: 't1', show: true },
      { programId: 'p1', facilityTypeId: 't2', show: false },
      { programId: 'p2', facilityTypeId: 't1', show: true },
    ];
    expect(diffPairs(saved, draft)).toEqual({ remove: [], add: [] });
  });

  it('removes the pairs taken out and adds the new ones', () => {
    const draft = [
      { programId: 'p1', facilityTypeId: 't1', show: true },
      { programId: 'p1', facilityTypeId: 't2', show: false },
      { programId: 'p3', facilityTypeId: 't3', show: false },
    ];
    expect(diffPairs(saved, draft)).toEqual({
      remove: [saved[2]],
      add: [{ programId: 'p3', facilityTypeId: 't3', show: false }],
    });
  });

  it('replaces a pair whose Show changed, since the server only adds and removes', () => {
    const draft = [
      { programId: 'p1', facilityTypeId: 't1', show: false },
      { programId: 'p1', facilityTypeId: 't2', show: false },
      { programId: 'p2', facilityTypeId: 't1', show: true },
    ];
    expect(diffPairs(saved, draft)).toEqual({
      remove: [saved[0]],
      add: [{ programId: 'p1', facilityTypeId: 't1', show: false }],
    });
  });
});
