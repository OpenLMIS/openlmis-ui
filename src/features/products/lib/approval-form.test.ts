import { describe, expect, it } from 'vitest';
import {
  type ApprovalFormValues,
  approvalFormSchema,
  EMPTY_APPROVAL_FORM,
  groupApprovals,
  toApprovalFormValues,
  toApprovalStock,
} from '@/features/products/lib/approval-form';
import type { Approval } from '@/features/products/lib/types';

const approval = (
  id: string,
  facilityType: [string, string],
  program: [string, string],
  stock: Partial<Approval> = {},
): Approval => ({
  id,
  maxPeriodsOfStock: 3,
  minPeriodsOfStock: 1.5,
  emergencyOrderPoint: 1,
  active: true,
  orderable: { id: 'o1' },
  facilityType: { id: facilityType[0], code: facilityType[0], name: facilityType[1] },
  program: { id: program[0], code: program[0], name: program[1] },
  ...stock,
});

const healthCenterFp = approval('a1', ['hc', 'Health Center'], ['fp', 'Family Planning']);
const healthCenterEm = approval('a2', ['hc', 'Health Center'], ['em', 'Essential Meds']);
const hospitalFp = approval('a3', ['dh', 'District Hospital'], ['fp', 'Family Planning']);

const valid: ApprovalFormValues = {
  ...EMPTY_APPROVAL_FORM,
  facilityTypeId: 'dh',
  programId: 'em',
  maxPeriodsOfStock: '3',
};

const messages = (values: ApprovalFormValues, approved: Approval[] = [], editing?: string) =>
  approvalFormSchema(approved, editing)
    .safeParse(values)
    .error?.issues.map((issue) => [issue.path[0], issue.message]);

describe('approvalFormSchema', () => {
  it('starts empty', () => {
    expect(EMPTY_APPROVAL_FORM).toEqual({
      facilityTypeId: null,
      programId: null,
      maxPeriodsOfStock: '',
      emergencyOrderPoint: '',
      minPeriodsOfStock: '',
    });
  });

  it('needs a facility type, a program and the most periods of stock', () => {
    expect(messages(valid)).toBeUndefined();
    expect(messages(EMPTY_APPROVAL_FORM)).toEqual([
      ['facilityTypeId', 'products.approvals.form.facility-type-required'],
      ['programId', 'products.approvals.form.program-required'],
      ['maxPeriodsOfStock', 'products.approvals.form.max-required'],
    ]);
  });

  it('takes numbers that are not negative, with decimals, without rewriting them', () => {
    expect(
      messages({ ...valid, maxPeriodsOfStock: '1.5', emergencyOrderPoint: '0.5' }),
    ).toBeUndefined();
    expect(messages({ ...valid, maxPeriodsOfStock: '-1', minPeriodsOfStock: 'abc' })).toEqual([
      ['maxPeriodsOfStock', 'products.approvals.form.number'],
      ['minPeriodsOfStock', 'products.approvals.form.number'],
    ]);
  });

  it('refuses a pair that is already approved, but not the approval being edited', () => {
    const pair = { ...valid, facilityTypeId: 'hc', programId: 'fp' };
    expect(messages(pair, [healthCenterFp])).toEqual([
      ['programId', 'products.approvals.form.duplicate'],
    ]);
    expect(messages(pair, [healthCenterFp], 'a1')).toBeUndefined();
  });
});

describe('toApprovalFormValues', () => {
  it('fills the form with the approval, numbers as text', () => {
    expect(toApprovalFormValues(healthCenterFp)).toEqual({
      facilityTypeId: 'hc',
      programId: 'fp',
      maxPeriodsOfStock: '3',
      emergencyOrderPoint: '1',
      minPeriodsOfStock: '1.5',
    });
    expect(
      toApprovalFormValues({
        ...healthCenterFp,
        emergencyOrderPoint: null,
        minPeriodsOfStock: null,
      }),
    ).toMatchObject({ emergencyOrderPoint: '', minPeriodsOfStock: '' });
  });
});

describe('toApprovalStock', () => {
  it('reads the numbers, an empty one as none', () => {
    expect(
      toApprovalStock({ ...valid, maxPeriodsOfStock: '٢٫٥', emergencyOrderPoint: '' }),
    ).toEqual({ maxPeriodsOfStock: 2.5, emergencyOrderPoint: null, minPeriodsOfStock: null });
  });
});

describe('groupApprovals', () => {
  it('groups approvals by facility type, each by program name', () => {
    expect(groupApprovals([healthCenterFp, hospitalFp, healthCenterEm])).toEqual([
      { facilityType: hospitalFp.facilityType, approvals: [hospitalFp] },
      { facilityType: healthCenterFp.facilityType, approvals: [healthCenterEm, healthCenterFp] },
    ]);
  });
});
