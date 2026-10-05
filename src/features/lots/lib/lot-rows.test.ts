import { describe, expect, it } from 'vitest';
import { toLotRows } from '@/features/lots/lib/lot-rows';
import type { Lot } from '@/features/lots/lib/types';
import type { Orderable } from '@/features/reference-data/lib/types';

const lot = (id: string, tradeItemId: string): Lot => ({
  id,
  lotCode: id.toUpperCase(),
  active: true,
  tradeItemId,
  expirationDate: '2019-01-30',
  manufactureDate: '2017-01-30',
});

const orderable = (id: string, tradeItem: string): Orderable => ({
  id,
  productCode: id.toUpperCase(),
  fullProductName: `Product ${id}`,
  description: null,
  identifiers: { tradeItem },
});

describe('toLotRows', () => {
  it('gives each lot the product of its trade item', () => {
    const c1 = orderable('c1', 't1');
    const c2 = orderable('c2', 't2');

    expect(toLotRows([lot('l1', 't2'), lot('l2', 't1')], [c1, c2])).toEqual([
      { ...lot('l1', 't2'), product: c2 },
      { ...lot('l2', 't1'), product: c1 },
    ]);
  });

  it('matches trade items whatever their case', () => {
    const c1 = orderable('c1', 'ABC');

    expect(toLotRows([lot('l1', 'abc')], [c1])).toEqual([{ ...lot('l1', 'abc'), product: c1 }]);
  });

  it('leaves the product out when none has the trade item', () => {
    expect(toLotRows([lot('l1', 't9')], [orderable('c1', 't1')])).toEqual([
      { ...lot('l1', 't9'), product: null },
    ]);
  });
});
