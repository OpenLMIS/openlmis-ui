import type { QueryClient } from '@tanstack/react-query';
import { permissionsOptions } from '@/features/auth/api/queries';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { rolesOptions, userRecordOptions } from '@/features/reference-data/api/queries';
import type { Role } from '@/features/reference-data/lib/types';
import type { Permissions } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import { getSessionScope, SessionEndedError } from '@/lib/session-scope';
import type { UserRecord } from '@/lib/user-types';

export function requisitionViewNodes(
  user: Pick<UserRecord, 'roleAssignments'>,
  roles: readonly Role[],
) {
  const viewers = new Set(
    roles
      .filter((role) => role.rights.some((right) => right.name === RIGHTS.requisitionView))
      .map((role) => role.id),
  );
  return [
    ...new Set(
      user.roleAssignments.flatMap((assignment) =>
        assignment.supervisoryNodeId && viewers.has(assignment.roleId)
          ? [assignment.supervisoryNodeId]
          : [],
      ),
    ),
  ];
}

export function canViewRequisitions(
  permissions: Permissions,
  user: Pick<UserRecord, 'roleAssignments'>,
  roles: readonly Role[],
) {
  return (
    permissions.grants.some((grant) => grant.right === RIGHTS.requisitionView) ||
    requisitionViewNodes(user, roles).length > 0
  );
}

export async function requireRequisitionView(queryClient: QueryClient) {
  while (true) {
    const scope = getSessionScope();
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) throw new SessionEndedError();
    try {
      const [permissions, user, roles] = await Promise.all([
        queryClient.fetchQuery(permissionsOptions(userId)),
        queryClient.fetchQuery(userRecordOptions(userId)),
        queryClient.fetchQuery(rolesOptions()),
      ]);
      if (scope !== getSessionScope()) continue;
      if (!canViewRequisitions(permissions, user, roles))
        throw new ForbiddenError(RIGHTS.requisitionView);
      return { permissions, user, roles };
    } catch (error) {
      if (scope !== getSessionScope()) continue;
      throw error;
    }
  }
}
