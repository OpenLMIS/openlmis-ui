import type {
  FacilityTypeBody,
  FacilityTypesQuery,
  NewFacilityTypeBody,
} from '@/features/facility-types/lib/types';
import type { FacilityType } from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchFacilityTypesPage(query: FacilityTypesQuery) {
  const { data } = await client.get<Page<FacilityType>>('/facilityTypes', { params: query });
  return data;
}

export async function fetchFacilityType(id: string): Promise<FacilityType> {
  const { data } = await client.get<FacilityType>(`/facilityTypes/${id}`);
  return data;
}

export async function createFacilityType(body: NewFacilityTypeBody): Promise<FacilityType> {
  const { data } = await client.post<FacilityType>('/facilityTypes', body);
  return data;
}

export async function updateFacilityType(
  id: string,
  body: FacilityTypeBody,
): Promise<FacilityType> {
  const { data } = await client.put<FacilityType>(`/facilityTypes/${id}`, body);
  return data;
}
