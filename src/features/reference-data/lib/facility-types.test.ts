import { describe, expect, it } from 'vitest';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';

describe('facilityTypeName', () => {
  it('names a facility type by its name, or by its code when it has none', () => {
    expect(facilityTypeName({ code: 'hc', name: 'Health Center' })).toBe('Health Center');
    expect(facilityTypeName({ code: 'hc', name: null })).toBe('hc');
    expect(facilityTypeName({ code: 'hc', name: '' })).toBe('hc');
  });
});
