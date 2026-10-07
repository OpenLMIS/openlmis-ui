import { describe, expect, it } from 'vitest';
import { EMPTY_VALUE, orEmpty } from '@/lib/empty-value';

describe('orEmpty', () => {
  it('shows the empty value for a missing or blank value', () => {
    expect(orEmpty(undefined)).toBe(EMPTY_VALUE);
    expect(orEmpty(null)).toBe(EMPTY_VALUE);
    expect(orEmpty('')).toBe(EMPTY_VALUE);
  });

  it('keeps a value, zero included', () => {
    expect(orEmpty('Stolen')).toBe('Stolen');
    expect(orEmpty(0)).toBe(0);
  });
});
