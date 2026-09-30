import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { queryKeys, userRightsKey } from '@/lib/key-factory';
import { invalidateUserQueries } from '@/lib/user-queries';

function seeded() {
  const queryClient = new QueryClient();
  for (const queryKey of [
    userRightsKey('ada-id'),
    queryKeys.profile.detail('ada-id'),
    [...queryKeys.home.all, 'first-name', 'ada-id'],
    queryKeys.users.list(),
    queryKeys.roles.list(),
  ]) {
    queryClient.setQueryData(queryKey, {});
  }
  const stale = () =>
    queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => query.isStale())
      .map((query) => query.queryKey[0]);
  return { queryClient, stale };
}

describe('invalidateUserQueries', () => {
  it("reloads the users, and the user's rights, Profile and Home, which exist only for you", () => {
    const { queryClient, stale } = seeded();

    invalidateUserQueries(queryClient, 'ada-id');

    expect(stale()).toEqual(['auth', 'profile', 'home', 'users']);
  });
});
