import type { FacilitiesQuery, FacilityBody } from '@/features/facilities/lib/types';
import type { Facility } from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchFacilitiesPage({ name, zoneId, ...paging }: FacilitiesQuery) {
  const { data } = await client.post<Page<Facility>>(
    '/facilities/search',
    { name, zoneId },
    { params: paging },
  );
  return data;
}

export async function createFacility(body: FacilityBody) {
  const { data } = await client.post<Facility>('/facilities', body);
  return data;
}
