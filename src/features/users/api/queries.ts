import { queryOptions } from '@tanstack/react-query';
import { fetchUserDetails, fetchUsers, findMatchingUserIds } from '@/features/users/api/api';
import type { UsersQuery } from '@/features/users/lib/types';
import { queryKeys } from '@/lib/key-factory';

/** Search matches depend only on the term, so paging and sorting reuse them instead of searching again. */
export const userMatchesOptions = (term: string) =>
  queryOptions({
    queryKey: [...queryKeys.users.all, 'matches', term] as const,
    queryFn: () => findMatchingUserIds(term),
  });

export const usersListOptions = (query: UsersQuery) =>
  queryOptions({
    queryKey: queryKeys.users.list(query),
    queryFn: async ({ client }) =>
      fetchUsers(query, query.q ? await client.fetchQuery(userMatchesOptions(query.q)) : undefined),
  });

export const userDetailsOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => fetchUserDetails(id),
  });
