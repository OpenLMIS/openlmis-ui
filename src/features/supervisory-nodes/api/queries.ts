import { queryOptions } from '@tanstack/react-query';
import {
  fetchSupervisoryNodeRows,
  fetchSupervisoryNodesByIds,
} from '@/features/supervisory-nodes/api/api';
import type { SupervisoryNodesQuery } from '@/features/supervisory-nodes/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const supervisoryNodesPageOptions = (query: SupervisoryNodesQuery) =>
  queryOptions({
    queryKey: queryKeys.supervisoryNodes.list(query),
    queryFn: () => fetchSupervisoryNodeRows(query),
  });

export const supervisoryNodesByIdsOptions = (ids: readonly string[]) =>
  queryOptions({
    queryKey: [...queryKeys.supervisoryNodes.all, 'byIds', ids],
    queryFn: () => fetchSupervisoryNodesByIds(ids),
  });
