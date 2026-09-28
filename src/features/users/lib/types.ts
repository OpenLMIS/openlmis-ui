import type { User, UserContactDetails, UserRecord } from '@/lib/user-types';

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
