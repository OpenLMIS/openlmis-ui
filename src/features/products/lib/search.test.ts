import { describe, expect, it } from 'vitest';
import {
  hasProductFilters,
  productsSearchSchema,
  toProductsQuery,
} from '@/features/products/lib/search';

describe('productsSearchSchema', () => {
  it('drops blank filters and keeps the rest as typed', () => {
    expect(productsSearchSchema.parse({ q: ' ', program: '  ' })).toEqual({});
    expect(productsSearchSchema.parse({ q: ' 0363 ', program: 'PRG002' })).toEqual({
      q: ' 0363 ',
      program: 'PRG002',
    });
  });

  it('keeps a search the router read as a number, as in a link typed by hand', () => {
    expect(productsSearchSchema.parse({ q: 1133 })).toEqual({ q: '1133' });
  });

  it('drops the separate code and name filters, which the search replaces', () => {
    expect(productsSearchSchema.parse({ code: '0363', name: 'allergy' })).toEqual({});
  });

  it('falls back on a bad page, page size or dialog', () => {
    expect(productsSearchSchema.parse({ page: 0, size: 7, product: 'o1' })).toEqual({});
    expect(productsSearchSchema.parse({ page: 3, size: 20, product: 'new' })).toEqual({
      page: 3,
      size: 20,
      product: 'new',
    });
  });

  it('keeps no sort in the URL, since the server orders a filtered list by name anyway', () => {
    expect(productsSearchSchema.parse({ sort: 'productCode', dir: 'desc' })).toEqual({});
  });
});

describe('toProductsQuery', () => {
  it('maps the URL to a zero-based request sorted by name', () => {
    expect(toProductsQuery({})).toEqual({
      page: 0,
      size: 10,
      sort: 'fullProductName,asc',
      q: undefined,
      program: undefined,
    });
  });

  it('trims the search and the program for the API', () => {
    expect(toProductsQuery({ page: 2, q: ' hour allergy ', program: 'PRG002' })).toEqual({
      page: 1,
      size: 10,
      sort: 'fullProductName,asc',
      q: 'hour allergy',
      program: 'PRG002',
    });
  });
});

describe('hasProductFilters', () => {
  it('counts the search and the program, not paging or the dialog', () => {
    expect(hasProductFilters({ page: 4, size: 20, product: 'new' })).toBe(false);
    expect(hasProductFilters({ q: '0363' })).toBe(true);
    expect(hasProductFilters({ program: 'PRG001' })).toBe(true);
  });
});
