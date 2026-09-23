import { queryOptions } from '@tanstack/react-query';
import { fetchMinimalFacilities } from '@/features/reference-data/api/api';
import { queryKeys } from '@/lib/key-factory';

export const minimalFacilitiesOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.facilities.all, 'minimal'] as const,
    queryFn: fetchMinimalFacilities,
    // Thousands of rows that rarely change, so one fetch serves every picker for a while.
    staleTime: 10 * 60 * 1000,
  });
