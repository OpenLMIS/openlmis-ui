import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { systemNotificationsOptions } from '@/features/home/api/queries';
import { contactDetailsOptions } from '@/features/profile/api/queries';
import { queryKeys, userProgramsKey, userRecordKey, userRightsKey } from '@/lib/key-factory';
import { invalidateUserQueries } from '@/lib/user-queries';

function seeded() {
  const queryClient = new QueryClient();
  for (const queryKey of [
    userRightsKey('ada-id'),
    contactDetailsOptions('ada-id').queryKey,
    systemNotificationsOptions().queryKey,
    queryKeys.users.list(),
    userRecordKey('ada-id'),
    userProgramsKey('ada-id'),
    queryKeys.roles.list(),
  ]) {
    queryClient.setQueryData(queryKey, {});
  }
  const stale = () =>
    queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => query.isStale())
      .map((query) => query.queryKey);
  return { queryClient, stale };
}

describe('invalidateUserQueries', () => {
  it("reloads the users, and the user's rights, Profile and Home, which exist only for you", () => {
    const { queryClient, stale } = seeded();

    invalidateUserQueries(queryClient, 'ada-id');

    expect(stale()).toEqual([
      userRightsKey('ada-id'),
      contactDetailsOptions('ada-id').queryKey,
      systemNotificationsOptions().queryKey,
      queryKeys.users.list(),
      userRecordKey('ada-id'),
      userProgramsKey('ada-id'),
    ]);
  });
});
