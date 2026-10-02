import { describe, expect, it } from 'vitest';
import { groupApprovals } from '@/features/products/lib/approvals';
import type { Approval } from '@/features/products/lib/types';

const approval = (id: string, facilityType: [string, string], program: [string, string]) =>
  ({
    id,
    maxPeriodsOfStock: 3,
    active: true,
    orderable: { id: 'o1' },
    facilityType: { id: facilityType[0], code: facilityType[0], name: facilityType[1] },
    program: { id: program[0], code: program[0], name: program[1] },
  }) satisfies Approval;

const healthCenterFp = approval('a1', ['hc', 'Health Center'], ['fp', 'Family Planning']);
const healthCenterEm = approval('a2', ['hc', 'Health Center'], ['em', 'Essential Meds']);
const hospitalFp = approval('a3', ['dh', 'District Hospital'], ['fp', 'Family Planning']);

describe('groupApprovals', () => {
  it('groups approvals by facility type, each by program name', () => {
    expect(groupApprovals([healthCenterFp, hospitalFp, healthCenterEm])).toEqual([
      { facilityType: hospitalFp.facilityType, approvals: [hospitalFp] },
      { facilityType: healthCenterFp.facilityType, approvals: [healthCenterEm, healthCenterFp] },
    ]);
  });
});

describe('groupApprovals with records that have no name', () => {
  it('sorts them by the code they are shown with', () => {
    const unnamedType = {
      ...approval('a4', ['zz', 'Z'], ['fp', 'Family Planning']),
      facilityType: { id: 'aa', code: 'aa_type', name: null },
    };
    const unnamedProgram = {
      ...approval('a5', ['hc', 'Health Center'], ['xx', 'X']),
      program: { id: 'xx', code: 'ZZ9', name: null },
    };
    const groups = groupApprovals([healthCenterFp, unnamedType, unnamedProgram]);

    expect(groups.map((group) => group.facilityType.id)).toEqual(['aa', 'hc']);
    expect(groups[1].approvals.map((item) => item.id)).toEqual(['a1', 'a5']);
  });
});
