import { describe, expect, it } from 'vitest';
import {
  CLEARED_FACILITY_FILTERS,
  facilitiesSearchSchema,
  hasFacilityFilters,
  toFacilitiesQuery,
} from '@/features/facilities/lib/search';

const zoneId = 'ef9a2b39-e7ce-4ebe-930c-f5c6d15b578a';

describe('facilitiesSearchSchema', () => {
  it('keeps valid params and drops invalid ones', () => {
    expect(
      facilitiesSearchSchema.parse({ page: 2, size: 20, sort: 'code', dir: 'desc', zoneId }),
    ).toEqual({ page: 2, size: 20, sort: 'code', dir: 'desc', zoneId });
    expect(
      facilitiesSearchSchema.parse({ page: 0, size: 7, sort: 'geographicZone', zoneId: 'x' }),
    ).toEqual({});
  });

  it('keeps a name that looks like a number as text, and drops a blank one', () => {
    expect(facilitiesSearchSchema.parse({ name: 1133 })).toEqual({ name: '1133' });
    expect(facilitiesSearchSchema.parse({ name: '  ' })).toEqual({});
  });
});

describe('toFacilitiesQuery', () => {
  it('asks for the first page by name by default, zero-based, with no filters', () => {
    expect(toFacilitiesQuery({})).toEqual({ page: 0, size: 10, sort: 'name,asc' });
  });

  it('passes the page, size, sort and trimmed filters to the server', () => {
    expect(
      toFacilitiesQuery({
        page: 3,
        size: 20,
        sort: 'enabled',
        dir: 'desc',
        name: ' Comfort ',
        zoneId,
      }),
    ).toEqual({ page: 2, size: 20, sort: 'enabled,desc', name: 'Comfort', zoneId });
  });
});

describe('facility filters', () => {
  it('knows when a filter is set, and clears both back to page 1', () => {
    expect(hasFacilityFilters({})).toBe(false);
    expect(hasFacilityFilters({ name: 'Comfort' })).toBe(true);
    expect(hasFacilityFilters({ zoneId })).toBe(true);
    expect(CLEARED_FACILITY_FILTERS).toEqual({
      name: undefined,
      zoneId: undefined,
      page: undefined,
    });
  });
});
