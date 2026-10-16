import { queryOptions } from '@tanstack/react-query';
import {
  fetchSupervisoryNode,
  fetchSupervisoryNodeRows,
} from '@/features/supervisory-nodes/api/api';
import type { SupervisoryNodesQuery } from '@/features/supervisory-nodes/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const supervisoryNodesPageOptions = (query: SupervisoryNodesQuery) =>
  queryOptions({
    queryKey: queryKeys.supervisoryNodes.list(query),
    queryFn: () => fetchSupervisoryNodeRows(query),
  });

export const supervisoryNodeOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.supervisoryNodes.detail(id),
    queryFn: () => fetchSupervisoryNode(id),
  });
