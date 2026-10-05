import { describe, expect, it } from 'vitest';
import { hasLotFilters, lotsSearchSchema, toLotsQuery } from '@/features/lots/lib/search';

const PRODUCT = '2400e410-b8dd-4954-b1c0-80d8a8e785fc';

describe('lotsSearchSchema', () => {
  it('keeps a product id and expiry dates', () => {
    expect(
      lotsSearchSchema.parse({
        product: PRODUCT,
        expiryFrom: '2019-01-01',
        expiryTo: '2019-06-30',
      }),
    ).toEqual({ product: PRODUCT, expiryFrom: '2019-01-01', expiryTo: '2019-06-30' });
  });

  it('drops what is not an id or a real date', () => {
    expect(
      lotsSearchSchema.parse({ product: 'C100', expiryFrom: '30/01/2019', expiryTo: '2019-02-30' }),
    ).toEqual({});
  });

  it('keeps the open lot', () => {
    expect(lotsSearchSchema.parse({ lot: PRODUCT })).toEqual({ lot: PRODUCT });
  });
});

describe('toLotsQuery', () => {
  it('asks for the first page of every lot by default', () => {
    expect(toLotsQuery({})).toEqual({ page: 0, size: 10, tradeItemIdIgnored: true });
  });

  it('sends the filters the URL holds, with the page counted from 0', () => {
    expect(
      toLotsQuery({
        page: 2,
        size: 20,
        product: PRODUCT,
        expiryFrom: '2019-01-01',
        expiryTo: '2019-06-30',
      }),
    ).toEqual({
      page: 1,
      size: 20,
      tradeItemIdIgnored: true,
      orderableId: PRODUCT,
      expirationDateFrom: '2019-01-01',
      expirationDateTo: '2019-06-30',
    });
  });
});

describe('hasLotFilters', () => {
  it('counts each filter', () => {
    expect(hasLotFilters({})).toBe(false);
    expect(hasLotFilters({ page: 2 })).toBe(false);
    expect(hasLotFilters({ product: PRODUCT })).toBe(true);
    expect(hasLotFilters({ expiryTo: '2019-06-30' })).toBe(true);
  });
});
