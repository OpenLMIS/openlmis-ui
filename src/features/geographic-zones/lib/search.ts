import { z } from 'zod';
import type { GeographicZonesQuery } from '@/features/geographic-zones/lib/types';
import { tableSearchSchema, textFilterSchema, toPaginationState } from '@/lib/table-search';
import { MAX_WHOLE_NUMBER } from '@/lib/whole-number';

export const geographicZonesSearchSchema = tableSearchSchema(['name']).extend({
  sort: z
    .literal('name')
    .transform(() => undefined)
    .optional()
    .catch(undefined),
  dir: z
    .enum(['asc', 'desc'])
    .transform(() => undefined)
    .optional()
    .catch(undefined),
  name: textFilterSchema,
  code: textFilterSchema,
  parent: z.guid().optional().catch(undefined),
  levelNumber: z
    .number()
    .int()
    .min(-2_147_483_648)
    .max(MAX_WHOLE_NUMBER)
    .optional()
    .catch(undefined),
  zone: z.guid().optional().catch(undefined),
  population: z.guid().optional().catch(undefined),
});

export type GeographicZonesSearch = z.infer<typeof geographicZonesSearchSchema>;

export const DEFAULT_GEOGRAPHIC_ZONES_SORT = { id: 'name', desc: false } as const;

export const CLEARED_GEOGRAPHIC_ZONE_FILTERS = {
  name: undefined,
  code: undefined,
  parent: undefined,
  levelNumber: undefined,
  page: undefined,
} satisfies Partial<GeographicZonesSearch>;

export function hasGeographicZoneFilters(search: GeographicZonesSearch) {
  return Boolean(search.name || search.code || search.parent || search.levelNumber !== undefined);
}

export function toGeographicZonesQuery(search: GeographicZonesSearch): GeographicZonesQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    page: pageIndex,
    size: pageSize,
    sort: 'name',
    ...(search.name?.trim() && { name: search.name.trim() }),
    ...(search.code?.trim() && { code: search.code.trim() }),
    ...(search.parent && { parent: search.parent }),
    ...(search.levelNumber !== undefined && { levelNumber: search.levelNumber }),
  };
}
