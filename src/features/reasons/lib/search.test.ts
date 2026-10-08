import { describe, expect, it } from 'vitest';
import { hasReasonFilters, reasonsSearchSchema } from '@/features/reasons/lib/search';

describe('reasonsSearchSchema', () => {
  it('keeps valid params and drops invalid ones', () => {
    expect(
      reasonsSearchSchema.parse({ page: 2, size: 20, sort: 'category', dir: 'desc', q: 'dam' }),
    ).toEqual({ page: 2, size: 20, sort: 'category', dir: 'desc', q: 'dam' });
    expect(reasonsSearchSchema.parse({ page: 0, size: 1001, sort: 'tags' })).toEqual({});
  });

  it('drops a blank search', () => {
    expect(reasonsSearchSchema.parse({ q: '  ' })).toEqual({});
  });
});

describe('hasReasonFilters', () => {
  it('counts the search only', () => {
    expect(hasReasonFilters({ q: 'dam' })).toBe(true);
    expect(hasReasonFilters({ page: 2, sort: 'type' })).toBe(false);
  });
});
