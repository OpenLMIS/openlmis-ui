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

/** The sign-in account; `enabled` is what lets the user log in. */
export type AuthUser = {
  id: string;
  username: string;
  enabled: boolean;
};

/** A user is kept in three services; an edit reads and writes all of them. */
export type UserDetails = {
  user: UserRecord;
  contact: UserContactDetails | null;
  auth: AuthUser | null;
};

/** A row of the users list: the reference data user joined with its contact email. */
export type UserListItem = User & {
  email: string | null;
};

/** Normalized request for one page of users; also the query key, so equal requests share a cache entry. */
export type UsersQuery = {
  page: number;
  size: number;
  sort: string;
  /** Matches username, first or last name, or email; any one is enough. */
  q?: string | undefined;
  active?: boolean | undefined;
};
