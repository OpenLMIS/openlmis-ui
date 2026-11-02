export type ProgramGrant = { right: string; facilityId: string; programId: string };

export type FacilityGrant = { right: string; facilityId: string };

export type Permissions = {
  rights: ReadonlySet<string>;
  facilityGrants?: readonly FacilityGrant[];
  grants: readonly ProgramGrant[];
};

export function parsePermissions(permissionStrings: readonly string[]): Permissions {
  const rights = new Set<string>();
  const facilities = new Map<string, FacilityGrant>();
  const grants = new Map<string, ProgramGrant>();
  for (const permission of permissionStrings) {
    const [right, facilityId, programId, ...rest] = permission.split('|');
    if (!right) continue;
    rights.add(right);
    if (facilityId && programId === undefined && rest.length === 0)
      facilities.set(permission, { right, facilityId });
    if (facilityId && programId && rest.length === 0) {
      grants.set(permission, { right, facilityId, programId });
    }
  }
  return { rights, facilityGrants: [...facilities.values()], grants: [...grants.values()] };
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

export function facilityGrants(permissions: Permissions, right: string) {
  return (permissions.facilityGrants ?? []).filter((grant) => grant.right === right);
}
