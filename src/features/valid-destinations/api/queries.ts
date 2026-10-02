import type { AssignmentsApi } from '@/components/valid-assignments/types';
import {
  createValidDestination,
  deleteValidDestination,
  fetchValidDestinations,
} from '@/features/valid-destinations/api/api';
import { queryKeys } from '@/lib/key-factory';

export const VALID_DESTINATIONS_API: AssignmentsApi = {
  kind: 'destinations',
  queryKey: queryKeys.validDestinations.all,
  fetchList: fetchValidDestinations,
  create: createValidDestination,
  remove: deleteValidDestination,
};
