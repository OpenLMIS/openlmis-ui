import { queryOptions } from '@tanstack/react-query';
import {
  fetchGeographicZone,
  fetchGeographicZoneChildren,
  fetchGeographicZonesPage,
} from '@/features/geographic-zones/api/api';
import type { GeographicZonesQuery } from '@/features/geographic-zones/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const geographicZonesListOptions = (query: GeographicZonesQuery) =>
  queryOptions({
    queryKey: queryKeys.geographicZones.list(query),
    queryFn: () => fetchGeographicZonesPage(query),
  });

export const geographicZoneDetailOptions = (id: string, opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.geographicZones.detail(id), opening] as const,
    queryFn: () => fetchGeographicZone(id),
  });

export const geographicZoneChildrenOptions = (parent: string, opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.geographicZones.all, 'list', 'children', parent, opening] as const,
    queryFn: () => fetchGeographicZoneChildren(parent),
  });
