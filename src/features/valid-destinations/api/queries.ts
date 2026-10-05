import { type QueryKey, queryOptions } from '@tanstack/react-query';
import type {
  AssignmentsApi,
  AssignmentsQuery,
  ValidAssignment,
} from '@/components/valid-assignments/types';
import {
  createValidDestination,
  deleteValidDestination,
  fetchValidDestinations,
} from '@/features/valid-destinations/api/api';
import { queryKeys } from '@/lib/key-factory';
import type { Page } from '@/lib/types';

export const validDestinationsListOptions = (query: AssignmentsQuery) =>
  queryOptions<Page<ValidAssignment>, Error, Page<ValidAssignment>, QueryKey>({
    queryKey: queryKeys.validDestinations.list(query),
    queryFn: () => fetchValidDestinations(query),
  });

export const VALID_DESTINATIONS_API: AssignmentsApi = {
  kind: 'destinations',
  queryKey: queryKeys.validDestinations.all,
  listOptions: validDestinationsListOptions,
  create: createValidDestination,
  remove: deleteValidDestination,
};
