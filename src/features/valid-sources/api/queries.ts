import { type QueryKey, queryOptions } from '@tanstack/react-query';
import type {
  AssignmentsApi,
  AssignmentsQuery,
  ValidAssignment,
} from '@/components/valid-assignments/types';
import {
  createValidSource,
  deleteValidSource,
  fetchValidSources,
} from '@/features/valid-sources/api/api';
import { queryKeys } from '@/lib/key-factory';
import type { Page } from '@/lib/types';

export const VALID_SOURCES_API: AssignmentsApi = {
  kind: 'sources',
  queryKey: queryKeys.validSources.all,
  listOptions: (query: AssignmentsQuery) =>
    queryOptions<Page<ValidAssignment>, Error, Page<ValidAssignment>, QueryKey>({
      queryKey: queryKeys.validSources.list(query),
      queryFn: () => fetchValidSources(query),
    }),
  create: createValidSource,
  remove: deleteValidSource,
};
