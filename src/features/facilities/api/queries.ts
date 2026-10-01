import { queryOptions } from '@tanstack/react-query';
import { fetchFacilitiesPage } from '@/features/facilities/api/api';
import type { FacilitiesQuery } from '@/features/facilities/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const facilitiesListOptions = (query: FacilitiesQuery) =>
  queryOptions({
    queryKey: queryKeys.facilities.list(query),
    queryFn: () => fetchFacilitiesPage(query),
  });
