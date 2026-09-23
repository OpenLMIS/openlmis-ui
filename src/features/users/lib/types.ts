export type User = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  active: boolean;
};

export type UserContactDetails = {
  referenceDataUserId: string;
  emailDetails: {
    email: string | null;
  } | null;
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
