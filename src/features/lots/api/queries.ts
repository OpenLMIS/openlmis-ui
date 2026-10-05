import { queryOptions } from '@tanstack/react-query';
import { fetchLot, fetchLotRows } from '@/features/lots/api/api';
import type { LotsQuery } from '@/features/lots/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const lotsListOptions = (query: LotsQuery) =>
  queryOptions({
    queryKey: queryKeys.lots.list(query),
    queryFn: () => fetchLotRows(query),
  });

export const lotDetailOptions = (id: string, opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.lots.detail(id), opening] as const,
    queryFn: () => fetchLot(id),
  });
