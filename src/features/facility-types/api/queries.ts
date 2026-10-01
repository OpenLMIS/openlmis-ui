import { queryOptions } from '@tanstack/react-query';
import { fetchFacilityType, fetchFacilityTypesPage } from '@/features/facility-types/api/api';
import type { FacilityTypesQuery } from '@/features/facility-types/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const facilityTypesListOptions = (query: FacilityTypesQuery) =>
  queryOptions({
    queryKey: queryKeys.facilityTypes.list(query),
    queryFn: () => fetchFacilityTypesPage(query),
  });

export const facilityTypeDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.facilityTypes.detail(id),
    queryFn: () => fetchFacilityType(id),
    staleTime: 0,
    gcTime: 0,
  });
