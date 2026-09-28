/** A user as the reference data and notification services hold them, read by several features. */

export type User = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  active: boolean;
};

export type UserContactDetails = {
  referenceDataUserId: string;
  phoneNumber?: string | null;
  allowNotify?: boolean | null;
  emailDetails: {
    email: string | null;
    emailVerified?: boolean | null;
  } | null;
};

/** A role granted to a user; one with a program and no supervisory node applies at the home facility. */
export type RoleAssignment = {
  roleId: string;
  programId?: string | null;
  supervisoryNodeId?: string | null;
  warehouseId?: string | null;
};

/** The full reference data user. Saving sends it back whole, so nothing is dropped by omission. */
export type UserRecord = User & {
  jobTitle?: string | null;
  timezone?: string | null;
  homeFacilityId?: string | null;
  extraData?: Record<string, unknown> | null;
  roleAssignments: RoleAssignment[];
};
