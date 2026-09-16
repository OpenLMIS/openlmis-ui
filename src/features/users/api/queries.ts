import { queryOptions } from '@tanstack/react-query';
import { getUser, getUsers } from '@/features/users/api/api';
import { queryKeys } from '@/lib/key-factory';

export const usersListOptions = queryOptions({
  queryKey: queryKeys.users.list(),
  queryFn: getUsers,
});

export const userDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.users.detail(id),
    queryFn: (ctx) => getUser(id, ctx),
  });
