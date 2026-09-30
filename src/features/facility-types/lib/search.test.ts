import { describe, expect, it } from 'vitest';
import {
  facilityTypesSearchSchema,
  toFacilityTypesQuery,
} from '@/features/facility-types/lib/search';

describe('facilityTypesSearchSchema', () => {
  it('keeps valid params and drops invalid ones', () => {
    expect(
      facilityTypesSearchSchema.parse({ page: 2, size: 20, sort: 'code', dir: 'desc' }),
    ).toEqual({ page: 2, size: 20, sort: 'code', dir: 'desc' });
    expect(facilityTypesSearchSchema.parse({ page: 0, size: 7, sort: 'bogus', dir: 'up' })).toEqual(
      {},
    );
  });

  it('opens the dialog for a new type or a type id', () => {
    const id = 'ac1d268b-ce10-455f-bf87-9c667da8f060';
    expect(facilityTypesSearchSchema.parse({ facilityType: 'new' })).toEqual({
      facilityType: 'new',
    });
    expect(facilityTypesSearchSchema.parse({ facilityType: id })).toEqual({ facilityType: id });
    expect(facilityTypesSearchSchema.parse({ facilityType: 'nope' })).toEqual({});
  });
});

describe('toFacilityTypesQuery', () => {
  it('asks for the first page in display order by default, zero-based', () => {
    expect(toFacilityTypesQuery({})).toEqual({ page: 0, size: 10, sort: 'displayOrder,asc' });
  });

  it('passes the chosen page, size and sort to the server', () => {
    expect(toFacilityTypesQuery({ page: 3, size: 50, sort: 'name', dir: 'desc' })).toEqual({
      page: 2,
      size: 50,
      sort: 'name,desc',
    });
  });
});
