import { describe, expect, it } from 'vitest';
import { eventLotOptions, eventProductOptions } from '@/features/stock-events/lib/products';
import type { EventStockCard } from '@/features/stock-events/lib/types';

const product = {
  id: 'o1',
  productCode: 'C1',
  fullProductName: 'Acetylsalicylic Acid',
  netContent: 16,
  dispensable: { displayUnit: '10 tab strip' },
  identifiers: { tradeItem: 't1' },
  extraData: { useVVM: 'true' },
};
const card = (id: string, lot: EventStockCard['lot'], stockOnHand = 0): EventStockCard => ({
  id,
  orderable: product,
  lot,
  stockOnHand,
});
const late = { id: 'l2', lotCode: 'LC2017B', expirationDate: '2019-08-20' };
const early = { id: 'l1', lotCode: 'LC2017A', expirationDate: '2019-01-30' };
const cards = [card('s2', late, 60), card('s0', null, 40), card('s1', early, 50)];

describe('eventProductOptions', () => {
  it('groups cards by orderable without dropping zero balances or expired lots', () => {
    const zero = {
      ...card('s3', null),
      orderable: { ...product, id: 'o2', fullProductName: null, dispensable: {} },
    };
    const options = eventProductOptions([...cards, zero]);
    expect(options).toHaveLength(2);
    expect(options[0]).toEqual({
      value: 'o1',
      label: 'Acetylsalicylic Acid - 10 tab strip',
      orderable: product,
      cards,
    });
    expect(options[1]).toMatchObject({ value: 'o2', label: 'C1', cards: [zero] });
    expect(eventProductOptions([])).toEqual([]);
  });
});

describe('eventLotOptions', () => {
  it('places the no-lot card first, sorts lots by expiry and retains expired lots', () => {
    const options = eventLotOptions(cards);
    expect(options.map((option) => option.value)).toEqual(['', 'l1', 'l2']);
    expect(options[0]).toEqual({
      value: '',
      lot: null,
      card: cards[1],
      labelKey: 'stock-events.no-lot-defined',
    });
    expect(options[1]).toEqual({ value: 'l1', lot: early, card: cards[2], label: 'LC2017A' });
    expect(cards[0]?.lot).toBe(late);
  });
  it('names a no-lot-only product with the distinct legacy message', () => {
    const noLot = card('s0', null);
    expect(eventLotOptions([noLot])).toEqual([
      { value: '', lot: null, card: noLot, labelKey: 'stock-events.product-has-no-lots' },
    ]);
    expect(eventLotOptions([])).toEqual([]);
  });
  it('dedupes lot ids while keeping the original stock card for each option', () => {
    expect(eventLotOptions([card('s1', early), card('s2', early)])).toHaveLength(1);
  });
});
