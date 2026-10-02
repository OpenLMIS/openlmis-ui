import { queryOptions } from '@tanstack/react-query';
import type { AssignmentsApi, AssignmentsQuery } from '@/components/valid-assignments/types';

export const assignmentsListOptions = (api: AssignmentsApi, query: AssignmentsQuery) =>
  queryOptions({
    queryKey: [...api.queryKey, 'list', query],
    queryFn: () => api.fetchList(query),
  });
