import type { GeographicZonesQuery } from '@/features/geographic-zones/lib/types';
import type { GeographicZone } from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchGeographicZonesPage({
  page,
  size,
  sort,
  ...filters
}: GeographicZonesQuery) {
  const { data } = await client.post<Page<GeographicZone>>('/geographicZones/search', filters, {
    params: { page, size, sort },
  });
  return data;
}

export async function fetchGeographicZoneChildren(parent: string) {
  const { data } = await client.post<Page<GeographicZone>>(
    '/geographicZones/search',
    { parent },
    {
      params: { sort: 'name' },
    },
  );
  return data.content;
}

export async function fetchGeographicZone(id: string) {
  const { data } = await client.get<GeographicZone>(`/geographicZones/${id}`);
  return data;
}

export async function updateGeographicZone(id: string, body: GeographicZone) {
  const { data } = await client.put<GeographicZone>(`/geographicZones/${id}`, body);
  return data;
}
