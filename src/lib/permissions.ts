/** A right held for one program at one facility, from a `RIGHT|facility|program` permission string. */
export type ProgramGrant = { right: string; facilityId: string; programId: string };

/** The signed-in user's permission strings, read once: every right name, and each facility and program grant. */
export type Permissions = {
  rights: ReadonlySet<string>;
  grants: readonly ProgramGrant[];
};

export function parsePermissions(permissionStrings: readonly string[]): Permissions {
  const rights = new Set<string>();
  const grants = new Map<string, ProgramGrant>();
  for (const permission of permissionStrings) {
    const [right, facilityId, programId, ...rest] = permission.split('|');
    if (!right) continue;
    rights.add(right);
    if (facilityId && programId && rest.length === 0) {
      grants.set(permission, { right, facilityId, programId });
    }
  }
  return { rights, grants: [...grants.values()] };
}

export function programGrants(permissions: Permissions, right: string): ProgramGrant[] {
  return permissions.grants.filter((grant) => grant.right === right);
}

/** Whether `right` is held for exactly this facility and program; holding it elsewhere never counts. */
export function hasProgramGrant(
  permissions: Permissions,
  right: string,
  facilityId: string,
  programId: string,
) {
  return permissions.grants.some(
    (grant) =>
      grant.right === right && grant.facilityId === facilityId && grant.programId === programId,
  );
}
