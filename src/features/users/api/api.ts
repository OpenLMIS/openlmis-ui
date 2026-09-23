import type {
  User,
  UserContactDetails,
  UserListItem,
  UsersQuery,
} from '@/features/users/lib/types';
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
