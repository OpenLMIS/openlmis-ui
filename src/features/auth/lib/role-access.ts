import { RIGHTS } from '@/features/auth/lib/rights';

export function toRoleAccess(rights: ReadonlySet<string>) {
  const canViewRights = rights.has(RIGHTS.rightsView);
  // Picking rights needs View Rights too, so editing without it would fail half way.
  return { canViewRights, canEdit: canViewRights && rights.has(RIGHTS.userRolesManage) };
}
