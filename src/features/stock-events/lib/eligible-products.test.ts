import { describe, expect, it } from 'vitest';
import { buildEligibleProducts } from '@/features/stock-events/lib/eligible-products';

const product = (id: string, tradeItem?: string) => ({
  id,
  productCode: id,
  fullProductName: id,
  description: null,
  identifiers: tradeItem ? { tradeItem } : undefined,
});
const approved = product('a');
const fulfilling = product('b', 'T');
const expired = { id: 'lot', lotCode: 'Old', expirationDate: '2000-01-01', tradeItemId: 't' };

describe('buildEligibleProducts', () => {
  it('expands approved products with fulfilling products, all their lots and no lot', () => {
    const result = buildEligibleProducts(
      [{ orderable: { id: 'a' }, canFulfillForMe: [] }],
      { a: { canFulfillForMe: ['b'], canBeFulfilledByMe: ['wrong'] } },
      [approved, fulfilling, product('wrong')],
      [expired],
    );
    expect(result.map((line) => [line.orderable.id, line.lot?.id ?? null])).toEqual([
      ['b', 'lot'],
      ['b', null],
      ['a', null],
    ]);
    expect(result[0].lot).toBe(expired);
    expect(result.every((line) => line.stockOnHand === null)).toBe(true);
  });
  it('retains existing cards, active flags and balances without duplicating lots', () => {
    const result = buildEligibleProducts(
      [
        {
          orderable: { id: 'b' },
          canFulfillForMe: [
            {
              orderable: { id: 'b' },
              lot: { id: 'lot' },
              stockOnHand: 0,
              stockCard: { id: 'card' },
              active: false,
            },
          ],
        },
      ],
      {},
      [fulfilling],
      [expired],
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      orderable: fulfilling,
      lot: expired,
      stockOnHand: 0,
      stockCardId: 'card',
      active: false,
    });
    expect(buildEligibleProducts([], {}, [], [])).toEqual([]);
  });
});
