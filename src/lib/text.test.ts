import { describe, expect, it } from 'vitest';
import { fullName } from '@/lib/text';

describe('fullName', () => {
  it('joins the names that are there', () => {
    expect(fullName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
    expect(fullName({ firstName: 'Ada', lastName: null })).toBe('Ada');
    expect(fullName({})).toBe('');
  });
});
