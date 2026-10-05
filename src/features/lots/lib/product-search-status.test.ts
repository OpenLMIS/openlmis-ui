import { describe, expect, it } from 'vitest';
import { productSearchStatus } from '@/features/lots/lib/product-search-status';

describe('productSearchStatus', () => {
  it('tells the user to type when the first page leaves products out', () => {
    expect(productSearchStatus({ listed: 20, total: 10233, typed: false })).toEqual({
      key: 'lots.search-hint',
      shown: 20,
      count: 10233,
    });
  });

  it('tells the user to type more when the matches do not fit', () => {
    expect(productSearchStatus({ listed: 20, total: 45, typed: true })).toEqual({
      key: 'lots.search-more',
      shown: 20,
      count: 45,
    });
  });

  it('counts every option listed, a linked product above the results included', () => {
    expect(productSearchStatus({ listed: 21, total: 10233, typed: false })?.shown).toBe(21);
  });

  it('says nothing when every match is listed', () => {
    expect(productSearchStatus({ listed: 5, total: 5, typed: true })).toBeUndefined();
    expect(productSearchStatus({ listed: 6, total: 5, typed: true })).toBeUndefined();
  });
});
