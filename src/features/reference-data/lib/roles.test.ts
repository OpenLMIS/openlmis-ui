import { describe, expect, it } from 'vitest';
import { rightLabel, roleTypeInfo, roleTypeOf } from '@/features/reference-data/lib/roles';

describe('roleTypeOf', () => {
  it("takes a role's type from its first right", () => {
    expect(
      roleTypeOf({
        id: 'r',
        name: 'R',
        rights: [{ id: 'a', name: 'ORDERS_VIEW', type: 'ORDER_FULFILLMENT' }],
      }),
    ).toBe('ORDER_FULFILLMENT');
  });

  it('gives no type to a role with no rights', () => {
    expect(roleTypeOf({ id: 'r', name: 'R', rights: [] })).toBeUndefined();
    expect(roleTypeOf(undefined)).toBeUndefined();
  });
});

describe('roleTypeInfo', () => {
  it('finds the label for a type', () => {
    expect(roleTypeInfo('GENERAL_ADMIN').labelKey).toBe('role-types.administration');
  });
});

describe('rightLabel', () => {
  it('turns a right code into words', () => {
    expect(rightLabel('REQUISITION_VIEW')).toBe('Requisition View');
    expect(rightLabel('APPROVE_BUQ')).toBe('Approve BUQ');
    expect(rightLabel('PODS_MANAGE')).toBe('PODs Manage');
  });
});
