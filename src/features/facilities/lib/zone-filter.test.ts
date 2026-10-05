import { describe, expect, it } from 'vitest';
import { toZoneOption } from '@/features/facilities/lib/zone-filter';
import type { GeographicZone } from '@/features/reference-data/lib/types';

const zone = (id: string, name: string, level: string | null): GeographicZone => ({
  id,
  code: id,
  name,
  level: { name: level },
});

describe('toZoneOption', () => {
  it('offers a zone by name, with its level', () => {
    expect(toZoneOption(zone('z1', 'Bilene', 'District'))).toEqual({
      value: 'z1',
      label: 'Bilene',
      description: 'District',
    });
  });

  it('leaves the level out for a zone without one', () => {
    expect(toZoneOption(zone('z3', 'Somewhere', null))).toEqual({
      value: 'z3',
      label: 'Somewhere',
    });
  });
});
