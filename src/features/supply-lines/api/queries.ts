import { queryOptions } from '@tanstack/react-query';
import {
  fetchServedFacilities,
  fetchSupplyLine,
  fetchSupplyLinesPage,
} from '@/features/supply-lines/api/api';
import type { SupplyLinesQuery } from '@/features/supply-lines/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const supplyLinesPageOptions = (query: SupplyLinesQuery) =>
  queryOptions({
    queryKey: queryKeys.supplyLines.list(query),
    queryFn: () => fetchSupplyLinesPage(query),
  });

export const supplyLineOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.supplyLines.detail(id),
    queryFn: () => fetchSupplyLine(id),
  });

export const servedFacilitiesOptions = (nodeId: string) =>
  queryOptions({
    queryKey: [...queryKeys.supplyLines.all, 'servedFacilities', nodeId],
    queryFn: () => fetchServedFacilities(nodeId),
    staleTime: 10 * 60 * 1000,
  });
