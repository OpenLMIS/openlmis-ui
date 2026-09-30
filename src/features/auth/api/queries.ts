import { queryOptions } from '@tanstack/react-query';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { toRights } from '@/features/auth/lib/rights';
import { userRightsKey } from '@/lib/key-factory';

export const rightsOptions = (userId: string) =>
  queryOptions({
    queryKey: userRightsKey(userId),
    // No one holds no rights; a page rendering while signing out must not ask for `/users//...`.
    queryFn: async () => toRights(userId ? await fetchPermissionStrings(userId) : []),
    // An admin can hold thousands of grants; they change rarely, so the session keeps one copy.
    staleTime: 30 * 60 * 1000,
    gcTime: Number.POSITIVE_INFINITY,
  });
