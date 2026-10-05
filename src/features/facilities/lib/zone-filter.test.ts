import { describe, expect, it } from 'vitest';
import { toZoneFilter } from '@/features/facilities/lib/zone-filter';
import type { GeographicZone } from '@/features/reference-data/lib/types';

const zone = (id: string, name: string, level: string | null): GeographicZone => ({
  id,
  code: id,
  name,
  level: { name: level },
});

const zones = [zone('z1', 'Bilene', 'District'), zone('z2', 'Gaza', 'Province')];

describe('toZoneFilter', () => {
  it('offers every zone by name, with its level, in the order the server sorts them', () => {
    expect(toZoneFilter(zones, undefined, 'Unknown Zone')).toEqual({
      value: '',
      options: [
        { value: 'z1', label: 'Bilene', description: 'District' },
        { value: 'z2', label: 'Gaza', description: 'Province' },
      ],
    });
  });

  it('leaves the level out for a zone without one', () => {
    expect(toZoneFilter([zone('z3', 'Somewhere', null)], undefined, '-').options).toEqual([
      { value: 'z3', label: 'Somewhere' },
    ]);
  });
});
