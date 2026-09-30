import type { QueryClient } from '@tanstack/react-query';
import { queryKeys, userRightsKey } from '@/lib/key-factory';

export function invalidateUserQueries(queryClient: QueryClient, userId: string): Promise<unknown> {
  return Promise.all(
    [userRightsKey(userId), queryKeys.profile.all, queryKeys.home.all, queryKeys.users.all].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
