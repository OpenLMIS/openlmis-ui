import { queryOptions } from '@tanstack/react-query';
import { fetchUsers } from '@/features/users/api/api';
import type { UsersQuery } from '@/features/users/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const usersListOptions = (query: UsersQuery) =>
  queryOptions({
    queryKey: queryKeys.users.list(query),
    queryFn: () => fetchUsers(query),
  });
