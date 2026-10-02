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

  it('keeps the picked zone', () => {
    expect(toZoneFilter(zones, 'z2', 'Unknown Zone').value).toBe('z2');
  });

  it('keeps a zone that no longer exists as its own option, once the zones are known', () => {
    const filter = toZoneFilter(zones, 'gone', 'Unknown Zone');
    expect(filter.value).toBe('gone');
    expect(filter.options[0]).toEqual({ value: 'gone', label: 'Unknown Zone' });
  });

  it('waits for the zones before calling the picked one unknown', () => {
    expect(toZoneFilter(undefined, 'z2', 'Unknown Zone')).toEqual({ value: 'z2', options: [] });
  });

  it('leaves the level out for a zone without one', () => {
    expect(toZoneFilter([zone('z3', 'Somewhere', null)], undefined, '-').options).toEqual([
      { value: 'z3', label: 'Somewhere' },
    ]);
  });
});
