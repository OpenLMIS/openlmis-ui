import type { GeographicZone } from '@/features/reference-data/lib/types';
import { withPicked } from '@/lib/filter-options';

export const toZoneOption = (zone: GeographicZone) => ({
  value: zone.id,
  label: zone.name,
  ...(zone.level.name && { description: zone.level.name }),
});

export const toZoneFilter = (
  zones: readonly GeographicZone[] | undefined,
  selected: string | undefined,
  unknownLabel: string,
) => withPicked(zones?.map(toZoneOption), selected, unknownLabel);
