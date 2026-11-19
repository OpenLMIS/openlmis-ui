import type { GeographicZone } from '@/features/reference-data/lib/types';

type Zone = Pick<GeographicZone, 'name' | 'level' | 'parent'>;

export function regionOf(zone: Zone | null | undefined): string {
  for (let current = zone; current; current = current.parent) {
    if (current.level.code === 'Region') return current.name;
  }
  return '';
}
