/** A role the user holds; one with a program and no supervisory node applies at the home facility. */
export type RoleAssignment = {
  roleId: string;
  programId?: string | null;
  supervisoryNodeId?: string | null;
  warehouseId?: string | null;
};

/** The reference data user. Saving sends it back whole, since the server refuses changes to most fields. */
export type ProfileUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  active: boolean;
  jobTitle?: string | null;
  timezone?: string | null;
  homeFacilityId?: string | null;
  extraData?: Record<string, unknown> | null;
  roleAssignments: RoleAssignment[];
};

export type ContactDetails = {
  referenceDataUserId: string;
  phoneNumber?: string | null;
  allowNotify?: boolean | null;
  emailDetails: {
    email: string | null;
    emailVerified?: boolean | null;
  } | null;
};

/** The user and their contact details; a user without contact details has `null`. */
export type Profile = {
  user: ProfileUser;
  contact: ContactDetails | null;
};

export type NotificationChannel = 'EMAIL' | 'SMS';

/** A kind of notification that can be gathered into a digest, e.g. `requisition-actionRequired`. */
export type DigestConfiguration = {
  id: string;
  tag: string;
  message?: string | null;
};

export type DigestSubscription = {
  digestConfiguration: { id: string };
  preferredChannel: NotificationChannel;
  useDigest: boolean;
  cronExpression?: string | null;
};
