import { describe, expect, it } from 'vitest';
import { EMPTY_ROLE_FORM, roleFormSchema, toRoleAssignment } from '@/features/users/lib/role-form';

const issues = (result: ReturnType<ReturnType<typeof roleFormSchema>['safeParse']>) =>
  result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

describe('roleFormSchema', () => {
  it('needs a program and a role for supervision, but no node', () => {
    expect(issues(roleFormSchema('SUPERVISION', []).safeParse(EMPTY_ROLE_FORM))).toEqual([
      'programId: users.roles.form.program-required',
      'roleId: users.roles.form.role-required',
    ]);
  });

  it('needs a facility for fulfillment', () => {
    expect(
      issues(
        roleFormSchema('ORDER_FULFILLMENT', []).safeParse({ ...EMPTY_ROLE_FORM, roleId: 'r' }),
      ),
    ).toEqual(['warehouseId: users.roles.form.facility-required']);
  });

  it('refuses a role already held in the same place', () => {
    const schema = roleFormSchema('SUPERVISION', [{ roleId: 'r', programId: 'p' }]);
    expect(issues(schema.safeParse({ ...EMPTY_ROLE_FORM, roleId: 'r', programId: 'p' }))).toEqual([
      'roleId: users.roles.form.duplicate',
    ]);
    expect(
      schema.safeParse({ ...EMPTY_ROLE_FORM, roleId: 'r', programId: 'p', supervisoryNodeId: 'n' })
        .success,
    ).toBe(true);
  });
});

describe('toRoleAssignment', () => {
  it('keeps only the ids its type uses', () => {
    const values = { roleId: 'r', programId: 'p', supervisoryNodeId: 'n', warehouseId: 'w' };
    expect(toRoleAssignment('SUPERVISION', values)).toEqual({
      roleId: 'r',
      programId: 'p',
      supervisoryNodeId: 'n',
    });
    expect(toRoleAssignment('ORDER_FULFILLMENT', values)).toEqual({
      roleId: 'r',
      warehouseId: 'w',
    });
    expect(toRoleAssignment('GENERAL_ADMIN', values)).toEqual({ roleId: 'r' });
  });
});
