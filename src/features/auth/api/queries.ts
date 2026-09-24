import { queryOptions } from '@tanstack/react-query';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { toRights } from '@/features/auth/lib/rights';
import { queryKeys } from '@/lib/key-factory';

export const rightsOptions = (userId: string) =>
  queryOptions({
    queryKey: [...queryKeys.auth.all, 'rights', userId] as const,
    queryFn: async () => toRights(await fetchPermissionStrings(userId)),
    // An admin can hold thousands of grants; they change rarely, so the session keeps one copy.
    staleTime: 30 * 60 * 1000,
    gcTime: Number.POSITIVE_INFINITY,
  });
