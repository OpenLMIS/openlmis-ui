import { describe, expect, it } from 'vitest';
import { programsSearchSchema, toProgramsQuery } from '@/features/programs/lib/search';

describe('programsSearchSchema', () => {
  it('keeps valid params and drops invalid ones', () => {
    expect(programsSearchSchema.parse({ page: 2, size: 20, sort: 'code', dir: 'desc' })).toEqual({
      page: 2,
      size: 20,
      sort: 'code',
      dir: 'desc',
    });
    expect(programsSearchSchema.parse({ page: 0, size: 7, sort: 'skipAuthorization' })).toEqual({});
  });

  it('opens the dialog for a new program or a program id', () => {
    const id = 'ef9a2b39-e7ce-4ebe-930c-f5c6d15b578a';
    expect(programsSearchSchema.parse({ program: 'new' })).toEqual({ program: 'new' });
    expect(programsSearchSchema.parse({ program: id })).toEqual({ program: id });
    expect(programsSearchSchema.parse({ program: 'nope' })).toEqual({});
  });
});

describe('toProgramsQuery', () => {
  it('asks for the first page by name by default, zero-based', () => {
    expect(toProgramsQuery({})).toEqual({ page: 0, size: 10, sort: 'name,asc' });
  });

  it('passes the chosen page, size and sort to the server', () => {
    expect(toProgramsQuery({ page: 2, size: 20, sort: 'active', dir: 'desc' })).toEqual({
      page: 1,
      size: 20,
      sort: 'active,desc',
    });
  });
});
