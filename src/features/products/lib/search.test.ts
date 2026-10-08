import { describe, expect, it } from 'vitest';
import {
  hasProductFilters,
  productsSearchSchema,
  toProductsQuery,
} from '@/features/products/lib/search';

describe('productsSearchSchema', () => {
  it('drops blank filters and keeps the rest as typed', () => {
    expect(productsSearchSchema.parse({ code: ' ', name: '', program: '  ' })).toEqual({});
    expect(
      productsSearchSchema.parse({ code: ' 0363 ', name: 'allergy', program: 'PRG002' }),
    ).toEqual({ code: ' 0363 ', name: 'allergy', program: 'PRG002' });
  });

  it('keeps a code the router read as a number, as in a link typed by hand', () => {
    expect(productsSearchSchema.parse({ code: 1133 })).toEqual({ code: '1133' });
  });

  it('drops a combined search, which the server cannot do', () => {
    expect(productsSearchSchema.parse({ q: '0363' })).toEqual({});
  });

  it('falls back on a bad page, page size or dialog', () => {
    expect(productsSearchSchema.parse({ page: 0, size: 1001, product: 'o1' })).toEqual({});
    expect(productsSearchSchema.parse({ page: 3, size: 20, product: 'new' })).toEqual({
      page: 3,
      size: 20,
      product: 'new',
    });
  });

  it('keeps no sort in the URL, since the list is always by name', () => {
    expect(productsSearchSchema.parse({ sort: 'productCode', dir: 'desc' })).toEqual({});
  });
});

describe('toProductsQuery', () => {
  it('maps the URL to a zero-based request sorted by name', () => {
    expect(toProductsQuery({})).toEqual({
      page: 0,
      size: 10,
      sort: 'fullProductName,asc',
      code: undefined,
      name: undefined,
      program: undefined,
    });
  });

  it('sends the code and name as the separate filters the server reads, trimmed', () => {
    expect(
      toProductsQuery({ page: 2, code: ' 0363 ', name: ' hour allergy ', program: 'PRG002' }),
    ).toEqual({
      page: 1,
      size: 10,
      sort: 'fullProductName,asc',
      code: '0363',
      name: 'hour allergy',
      program: 'PRG002',
    });
  });
});

describe('hasProductFilters', () => {
  it('counts the code, name and program, not paging or the dialog', () => {
    expect(hasProductFilters({ page: 4, size: 20, product: 'new' })).toBe(false);
    expect(hasProductFilters({ code: '0363' })).toBe(true);
    expect(hasProductFilters({ name: 'allergy' })).toBe(true);
    expect(hasProductFilters({ program: 'PRG001' })).toBe(true);
  });
});
