import { isAxiosError } from 'axios';
import { toSavedAssignment } from '@/features/users/lib/role-assignments';
import type {
  AuthUser,
  RoleAssignment,
  User,
  UserContactDetails,
  UserDetails,
  UserListItem,
  UserRecord,
  UsersQuery,
} from '@/features/users/lib/types';
import {
  toAuthUser,
  toContactDetails,
  toUserRecord,
  type UserFormValues,
} from '@/features/users/lib/user-form';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

// Spring binds repeated params (`id=a&id=b`), not axios's default `id[]=a`.
const repeatArrays = { indexes: null };

// The API has no "any of these fields" search, so each field is matched in full and the ids merged.
const MATCH_LIMIT = 10_000;
const MATCHED_USER_FIELDS = ['username', 'firstName', 'lastName'] as const;

function emptyPage<T>({ page, size }: UsersQuery): Page<T> {
  return { content: [], totalElements: 0, totalPages: 0, number: page, size };
}

async function fetchContactDetails(params: { id?: string[]; email?: string }) {
  const { data } = await client.get<Page<UserContactDetails>>('/userContactDetails', {
    params,
    paramsSerializer: repeatArrays,
  });
  return data.content;
}

/** Ids of users whose username, first name, last name or email contains `term`, or whose full name matches it. */
export async function findMatchingUserIds(term: string): Promise<string[]> {
  const [firstName, ...rest] = term.split(/\s+/);
  const lastName = rest.join(' ');
  const lookups = MATCHED_USER_FIELDS.map((field) => ({ [field]: term }));
  // A full name as the list shows it, "John Smith", lives in two fields, so it gets its own lookup.
  if (firstName && lastName) lookups.push({ firstName, lastName });

  const [contacts, ...pages] = await Promise.all([
    fetchContactDetails({ email: term }),
    ...lookups.map((params) =>
      client.get<Page<User>>('/users', { params: { ...params, size: MATCH_LIMIT } }),
    ),
  ]);
  return [
    ...new Set([
      ...contacts.map((contact) => contact.referenceDataUserId),
      ...pages.flatMap(({ data }) => data.content.map((user) => user.id)),
    ]),
  ];
}

/** One page of users with their emails; `ids`, when given, narrows the users to a search's matches. */
export async function fetchUsers(query: UsersQuery, ids?: string[]): Promise<Page<UserListItem>> {
  const { page, size, sort, active } = query;
  if (ids?.length === 0) return emptyPage(query);

  // The search endpoint takes the ids in the body, so a long list never hits a URL length limit.
  const { data: users } = await client.post<Page<User>>(
    '/users/search',
    { id: ids, active },
    { params: { page, size, sort } },
  );

  if (users.content.length === 0) return { ...users, content: [] };

  const contacts = await fetchContactDetails({ id: users.content.map((user) => user.id) });
  const emails = new Map(
    contacts.map((contact) => [contact.referenceDataUserId, contact.emailDetails?.email ?? null]),
  );

  return {
    ...users,
    content: users.content.map((user) => ({ ...user, email: emails.get(user.id) ?? null })),
  };
}

/** A user created before contact details or an account existed has none, which is not an error. */
async function getIfExists<T>(url: string): Promise<T | null> {
  try {
    const { data } = await client.get<T>(url);
    return data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function fetchUserDetails(id: string): Promise<UserDetails> {
  const [{ data: user }, contact, auth] = await Promise.all([
    client.get<UserRecord>(`/users/${id}`),
    getIfExists<UserContactDetails>(`/userContactDetails/${id}`),
    getIfExists<AuthUser>(`/users/auth/${id}`),
  ]);
  return { user, contact, auth };
}

/** Creates the user, then its contact details and sign-in account; undoes the user if either fails. */
export async function createUser(values: UserFormValues): Promise<UserRecord> {
  const { data: user } = await client.put<UserRecord>('/users', toUserRecord(values));

  try {
    await client.put(`/userContactDetails/${user.id}`, toContactDetails(user.id, values));
    await client.post('/users/auth', toAuthUser(user.id, values));
  } catch (error) {
    // Without this a retry would fail on the username the half-created user still holds.
    await client.delete(`/users/${user.id}`).catch(() => undefined);
    throw error;
  }

  return user;
}

/** One after another, so a rejected step stops the rest instead of leaving them half applied. */
export async function updateUser(details: UserDetails, values: UserFormValues): Promise<void> {
  const { id } = details.user;
  await client.put('/users', toUserRecord(values, details.user));
  await client.put(`/userContactDetails/${id}`, toContactDetails(id, values, details.contact));
  await client.post('/users/auth', toAuthUser(id, values));
}

export async function setUserPassword(username: string, newPassword: string): Promise<void> {
  await client.post('/users/auth/passwordReset', { username, newPassword });
}

/** Emails a link where the user chooses a password themselves. */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  await client.post('/users/auth/forgotPassword', undefined, { params: { email } });
}

/** Every user by username, for picking one; the list is short enough to search in the browser. */
export async function fetchAllUsers(): Promise<User[]> {
  const { data } = await client.get<Page<User>>('/users', { params: { sort: 'username,asc' } });
  return data.content;
}

/**
 * Replaces the user's roles and nothing else. The user is read fresh, so a change made
 * elsewhere since the page loaded is kept, and sign-in and contact details are left alone.
 */
export async function updateUserRoles(
  userId: string,
  roleAssignments: RoleAssignment[],
): Promise<UserRecord> {
  const { data: user } = await client.get<UserRecord>(`/users/${userId}`);
  const { data: saved } = await client.put<UserRecord>('/users', {
    ...user,
    roleAssignments: roleAssignments.map(toSavedAssignment),
  });
  return saved;
}
