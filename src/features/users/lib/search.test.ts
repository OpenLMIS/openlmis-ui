import { describe, expect, it } from 'vitest';
import { hasUserFilters, toUsersQuery, usersSearchSchema } from '@/features/users/lib/search';

describe('usersSearchSchema', () => {
  it('drops a blank search and keeps the rest as typed', () => {
    expect(usersSearchSchema.parse({ q: '  ' })).toEqual({});
    expect(usersSearchSchema.parse({ q: ' ada ' })).toEqual({ q: ' ada ' });
  });

  it('ignores an unknown status', () => {
    expect(usersSearchSchema.parse({ status: 'deleted' })).toEqual({});
  });
});

describe('toUsersQuery', () => {
  it('maps the URL to a zero-based, sorted API request', () => {
    expect(toUsersQuery({})).toEqual({
      page: 0,
      size: 10,
      sort: 'username,asc',
      q: undefined,
      active: undefined,
    });
  });

  it('trims the search for the API', () => {
    expect(toUsersQuery({ q: 'da silva ' })).toMatchObject({ q: 'da silva' });
  });

  it('maps the status filter to the active flag', () => {
    expect(
      toUsersQuery({ status: 'inactive', page: 2, sort: 'lastName', dir: 'desc' }),
    ).toMatchObject({ page: 1, sort: 'lastName,desc', active: false });
  });
});

describe('hasUserFilters', () => {
  it('counts the search and the status, not paging', () => {
    expect(hasUserFilters({ page: 4, sort: 'lastName' })).toBe(false);
    expect(hasUserFilters({ q: 'admin' })).toBe(true);
    expect(hasUserFilters({ status: 'active' })).toBe(true);
  });
});
