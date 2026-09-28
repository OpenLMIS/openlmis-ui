import { describe, expect, it } from 'vitest';
import { hasRoleFilters, rolesSearchSchema } from '@/features/roles/lib/search';

describe('rolesSearchSchema', () => {
  it('keeps valid params and drops invalid ones', () => {
    expect(
      rolesSearchSchema.parse({ q: ' lab ', type: 'REPORTS', sort: 'count', dir: 'desc' }),
    ).toEqual({ q: ' lab ', type: 'REPORTS', sort: 'count', dir: 'desc' });
    expect(rolesSearchSchema.parse({ q: ' ', type: 'OTHER', sort: 'rights' })).toEqual({});
  });

  it('opens the dialog for a new role or a role id', () => {
    const id = '0a4a1f6a-6b2c-4a8e-9c1d-2f3e4d5c6b7a';
    expect(rolesSearchSchema.parse({ role: 'new' })).toEqual({ role: 'new' });
    expect(rolesSearchSchema.parse({ role: id, rights: id })).toEqual({ role: id, rights: id });
    expect(rolesSearchSchema.parse({ role: 'nope', rights: 'x' })).toEqual({});
  });

  it('drops the type step param the dialog no longer has', () => {
    expect(rolesSearchSchema.parse({ role: 'new', roleType: 'SUPERVISION' })).toEqual({
      role: 'new',
    });
  });
});

describe('hasRoleFilters', () => {
  it('counts the search and the type, not paging', () => {
    expect(hasRoleFilters({ page: 2 })).toBe(false);
    expect(hasRoleFilters({ q: 'lab' })).toBe(true);
    expect(hasRoleFilters({ type: 'REPORTS' })).toBe(true);
  });
});
