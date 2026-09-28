import { queryOptions } from '@tanstack/react-query';
import { fetchServiceAccounts } from '@/features/service-accounts/api/api';
import type { ServiceAccountsQuery } from '@/features/service-accounts/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const serviceAccountsListOptions = (query: ServiceAccountsQuery) =>
  queryOptions({
    queryKey: queryKeys.serviceAccounts.list(query),
    queryFn: () => fetchServiceAccounts(query),
  });
