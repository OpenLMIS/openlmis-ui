import type { GeographicZone } from '@/features/reference-data/lib/types';

export const toZoneOption = (zone: GeographicZone) => ({
  value: zone.id,
  label: zone.name,
  ...(zone.level.name && { description: zone.level.name }),
});
