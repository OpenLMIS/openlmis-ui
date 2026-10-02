import type { AssignmentsApi } from '@/components/valid-assignments/types';
import {
  createValidSource,
  deleteValidSource,
  fetchValidSources,
} from '@/features/valid-sources/api/api';
import { queryKeys } from '@/lib/key-factory';

export const VALID_SOURCES_API: AssignmentsApi = {
  kind: 'sources',
  queryKey: queryKeys.validSources.all,
  fetchList: fetchValidSources,
  create: createValidSource,
  remove: deleteValidSource,
};
