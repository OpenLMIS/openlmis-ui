import type { GeographicZone } from '@/features/reference-data/lib/types';

type ZoneOption = { value: string; label: string; description?: string };

export const toZoneOption = (zone: GeographicZone): ZoneOption => ({
  value: zone.id,
  label: zone.name,
  ...(zone.level.name && { description: zone.level.name }),
});

export function toZoneFilter(
  zones: readonly GeographicZone[] | undefined,
  selected: string | undefined,
  unknownLabel: string,
): { value: string; options: ZoneOption[] } {
  const options = (zones ?? []).map(toZoneOption);
  if (!selected) return { value: '', options };
  if (!zones || options.some((option) => option.value === selected)) {
    return { value: selected, options };
  }
  return { value: selected, options: [{ value: selected, label: unknownLabel }, ...options] };
}
