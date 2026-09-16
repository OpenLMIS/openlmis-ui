import { QueryClient } from '@tanstack/react-query';
import { userDetailOptions, usersListOptions } from '@/features/users/api/queries';

// These tests cover what route loaders do. A loader like
//   loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(usersListOptions)
// is a thin wrapper - the behavior lives in the queryOptions + queryFn.
// Exercising them via `queryClient.fetchQuery(...)` hits the same code path
// without the overhead of rendering a full route through RouterProvider.

describe('user queries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      // Disable retries so failure tests finish quickly instead of retrying 3x.
      defaultOptions: { queries: { retry: false } },
    });
  });

  describe('usersListOptions', () => {
    it('fetches the list of users', async () => {
      const users = await queryClient.fetchQuery(usersListOptions);

      expect(users.length).toBeGreaterThan(0);
      expect(users.find((u) => u.id === 1)).toMatchObject({ name: 'Ada Lovelace' });
    });

    it('caches results so a second read does not refetch', async () => {
      const fetched = await queryClient.fetchQuery(usersListOptions);
      const cached = queryClient.getQueryData(usersListOptions.queryKey);

      expect(cached).toEqual(fetched);
    });
  });

  describe('userDetailOptions', () => {
    it('fetches a single user by id', async () => {
      const user = await queryClient.fetchQuery(userDetailOptions('1'));

      expect(user).toMatchObject({ id: 1, name: 'Ada Lovelace' });
    });

    it('throws when the user id is not found', async () => {
      await expect(queryClient.fetchQuery(userDetailOptions('999'))).rejects.toThrow(
        'User 999 not found',
      );
    });
  });
});
