import { describe, expect, it } from 'vitest';
import { toRoleAccess } from '@/features/auth/lib/role-access';

describe('toRoleAccess', () => {
  it('lets someone with View Rights see the rights of a role, and edit only with Manage User Roles too', () => {
    expect(toRoleAccess(new Set(['USERS_MANAGE']))).toEqual({
      canViewRights: false,
      canEdit: false,
    });
    expect(toRoleAccess(new Set(['RIGHTS_VIEW']))).toEqual({ canViewRights: true, canEdit: false });
    expect(toRoleAccess(new Set(['USER_ROLES_MANAGE']))).toEqual({
      canViewRights: false,
      canEdit: false,
    });
    expect(toRoleAccess(new Set(['RIGHTS_VIEW', 'USER_ROLES_MANAGE']))).toEqual({
      canViewRights: true,
      canEdit: true,
    });
  });
});
