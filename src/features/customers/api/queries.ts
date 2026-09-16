import { queryOptions } from '@tanstack/react-query';
import { getCustomer, getCustomers } from '@/features/customers/api/api';
import { queryKeys } from '@/lib/key-factory';

export const customersListOptions = queryOptions({
  queryKey: queryKeys.customers.list(),
  queryFn: getCustomers,
});

export const customerDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.customers.detail(id),
    queryFn: (ctx) => getCustomer(id, ctx),
  });
