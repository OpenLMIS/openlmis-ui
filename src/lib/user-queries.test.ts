import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { contactDetailsOptions } from '@/features/profile/api/queries';
import { systemNotificationsOptions } from '@/features/system-notifications/api/queries';
import { allUsersOptions, userMatchesOptions } from '@/features/users/api/queries';
import { queryKeys, userProgramsKey, userRecordKey, userRightsKey } from '@/lib/key-factory';
import { invalidateUserQueries, invalidateUsersAdminQueries } from '@/lib/user-queries';

const userId = 'ada-id';
const roles = queryKeys.roles.list();
const adminKeys = [
  queryKeys.users.list({ page: 0 }),
  queryKeys.users.list({ page: 1, q: 'Augusta' }),
  queryKeys.users.detail(userId),
  userMatchesOptions('Augusta').queryKey,
  allUsersOptions().queryKey,
];
const sessionKeys = [
  userRightsKey(userId),
  contactDetailsOptions(userId).queryKey,
  systemNotificationsOptions().queryKey,
  userRecordKey(userId),
  userProgramsKey(userId),
];

function seeded() {
  const queryClient = new QueryClient();
  for (const queryKey of [...adminKeys, ...sessionKeys, roles, queryKeys.users.detail('other')]) {
    queryClient.setQueryData(queryKey, {});
  }
  const invalidated = (queryKey: QueryKey) => queryClient.getQueryState(queryKey)?.isInvalidated;
  return { queryClient, invalidated };
}

describe('invalidateUserQueries', () => {
  it("invalidates Users admin data and the user's rights, Profile, Home and system notifications", async () => {
    const { queryClient, invalidated } = seeded();

    await invalidateUserQueries(queryClient, userId);

    for (const queryKey of [...adminKeys, ...sessionKeys]) {
      expect(invalidated(queryKey), JSON.stringify(queryKey)).toBe(true);
    }
    expect(invalidated(roles)).toBe(false);
  });
});

describe('invalidateUsersAdminQueries', () => {
  it('leaves session data, roles and other user details fresh after a self-service save', async () => {
    const { queryClient, invalidated } = seeded();

    await invalidateUsersAdminQueries(queryClient, userId);

    for (const queryKey of adminKeys) {
      expect(invalidated(queryKey), JSON.stringify(queryKey)).toBe(true);
    }
    for (const queryKey of [...sessionKeys, roles, queryKeys.users.detail('other')]) {
      expect(invalidated(queryKey), JSON.stringify(queryKey)).toBe(false);
    }
  });
});
