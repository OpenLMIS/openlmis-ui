import { queryOptions } from '@tanstack/react-query';
import { searchRequisitions } from '@/features/requisitions/api/api';
import type { RequisitionsQuery } from '@/features/requisitions/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const requisitionSearchOptions = (params: RequisitionsQuery) =>
  queryOptions({
    queryKey: queryKeys.requisitions.list(params),
    queryFn: () => searchRequisitions(params),
  });
