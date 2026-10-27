import { queryOptions } from '@tanstack/react-query';
import {
  fetchRequisition,
  fetchStatusMessages,
  searchRequisitions,
} from '@/features/requisitions/api/api';
import type { RequisitionsQuery } from '@/features/requisitions/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const requisitionSearchOptions = (params: RequisitionsQuery) =>
  queryOptions({
    queryKey: queryKeys.requisitions.list(params),
    queryFn: () => searchRequisitions(params),
  });

export const requisitionOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.requisitions.detail(id),
    queryFn: () => fetchRequisition(id),
  });
export const requisitionStatusMessagesOptions = (id: string) =>
  queryOptions({
    queryKey: [...queryKeys.requisitions.all, 'statusMessages', id] as const,
    queryFn: () => fetchStatusMessages(id),
  });
