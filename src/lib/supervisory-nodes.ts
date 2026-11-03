import type { Role } from '@/features/reference-data/lib/types';
import type { UserRecord } from '@/lib/user-types';

export function supervisoryNodesWithRight(
  user: Pick<UserRecord, 'roleAssignments'>,
  roles: readonly Role[],
  rightName: string,
  programId?: string,
) {
  const roleIds = new Set(
    roles
      .filter((role) => role.rights.some((right) => right.name === rightName))
      .map((role) => role.id),
  );
  return [
    ...new Set(
      user.roleAssignments.flatMap((assignment) =>
        assignment.supervisoryNodeId &&
        roleIds.has(assignment.roleId) &&
        (!programId || assignment.programId === programId)
          ? [assignment.supervisoryNodeId]
          : [],
      ),
    ),
  ];
}
