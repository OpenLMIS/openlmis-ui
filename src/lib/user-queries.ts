import type { QueryClient } from '@tanstack/react-query';
import { queryKeys, userRightsKey } from '@/lib/key-factory';

export function invalidateUserQueries(queryClient: QueryClient, userId: string): Promise<unknown> {
  void queryClient.invalidateQueries({ queryKey: queryKeys.systemNotifications.all });
  return Promise.all(
    [userRightsKey(userId), queryKeys.profile.all, queryKeys.home.all, queryKeys.users.all].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function invalidateUsersAdminQueries(
  queryClient: QueryClient,
  userId: string,
): Promise<unknown> {
  void queryClient.invalidateQueries({ queryKey: queryKeys.systemNotifications.all });
  const { matches, lists, detail, every } = queryKeys.users;
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: matches }),
    queryClient.invalidateQueries({ queryKey: lists }),
    queryClient.invalidateQueries({ queryKey: detail(userId), exact: true }),
    queryClient.invalidateQueries({ queryKey: every, exact: true }),
  ]);
}
