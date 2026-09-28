import { z } from 'zod';
import type { ServiceAccountsQuery } from '@/features/service-accounts/lib/types';
import {
  type DefaultSort,
  tableSearchSchema,
  toPaginationState,
  toSortingState,
} from '@/lib/table-search';

export const DEFAULT_SERVICE_ACCOUNTS_SORT: DefaultSort = { id: 'createdDate', desc: true };

export const serviceAccountsSearchSchema = tableSearchSchema(['createdDate']).extend({
  add: z.boolean().optional().catch(undefined),
  delete: z.guid().optional().catch(undefined),
});

export type ServiceAccountsSearch = z.infer<typeof serviceAccountsSearchSchema>;

export function toServiceAccountsQuery(search: ServiceAccountsSearch): ServiceAccountsQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  const desc = toSortingState(search, DEFAULT_SERVICE_ACCOUNTS_SORT)[0]?.desc ?? true;
  // The auth service sorts on the entity's path, not the field the response calls it.
  return {
    page: pageIndex,
    size: pageSize,
    sort: `creationDetails.createdDate,${desc ? 'desc' : 'asc'}`,
  };
}
