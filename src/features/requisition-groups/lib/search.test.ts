import { describe, expect, it } from 'vitest';
import { requisitionGroupsSearchSchema, toSearchBody } from './search';

describe('requisition group search', () => {
  it('sends an empty body without filters, including empty or blank values', () => {
    expect(toSearchBody({})).toEqual({});
    expect(toSearchBody({ name: '', zone: '  ', program: '\t' })).toEqual({});
    expect(toSearchBody({ page: 3, size: 20 })).toEqual({});
  });

  it('keeps nonblank filters and exact codes as typed in the URL', () => {
    const search = requisitionGroupsSearchSchema.parse({
      name: ' Family ',
      zone: 'Zone-01',
      program: 'prG001',
      page: 2,
      sort: 'name',
      dir: 'desc',
    });
    expect(search).not.toHaveProperty('sort');
    expect(search).not.toHaveProperty('dir');
    expect(toSearchBody(search)).toEqual({
      name: ' Family ',
      zone: 'Zone-01',
      program: 'prG001',
    });
    expect(toSearchBody({ name: 'Family', zone: '', program: ' ' })).toEqual({ name: 'Family' });
  });
});
