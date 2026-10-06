import { describe, expect, it } from 'vitest';
import { summaryIds, toStockGroups } from '@/features/stock-on-hand/lib/stock-groups';
import type { StockCardSummary, StockCardSummaryEntry } from '@/features/stock-on-hand/lib/types';

const product = (id: string, netContent = 10) => ({
  id,
  productCode: id.toUpperCase(),
  fullProductName: `Product ${id}`,
  description: null,
  netContent,
});

const lot = (id: string, lotCode: string) => ({ id, lotCode, expirationDate: '2027-01-31' });

const card = (
  id: string,
  overrides: Partial<StockCardSummaryEntry> = {},
): StockCardSummaryEntry => ({
  stockCard: { id },
  orderable: { id: 'p1' },
  lot: null,
  stockOnHand: 10,
  occurredDate: '2026-09-01',
  active: true,
  ...overrides,
});

const summary = (
  id: string,
  cards: StockCardSummaryEntry[],
  stockOnHand = 10,
): StockCardSummary => ({
  orderable: { id, versionNumber: 1 },
  stockOnHand,
  canFulfillForMe: cards,
});

describe('summaryIds', () => {
  it('names every product and lot on the page once, substitutes included', () => {
    const summaries = [
      summary('p1', [
        card('c1', { lot: { id: 'l1' } }),
        card('c2', { orderable: { id: 'p2' }, lot: { id: 'l1' } }),
      ]),
      summary('p3', [card('c3', { orderable: { id: 'p3' } })]),
    ];

    expect(summaryIds(summaries)).toEqual({
      orderableIds: ['p1', 'p2', 'p3'],
      lotIds: ['l1'],
    });
  });
});

describe('toStockGroups', () => {
  const products = [product('p1'), product('p2', 5)];
  const lots = [lot('lb', 'B-2'), lot('la', 'A-1')];

  it('lists the product, then its cards by lot code with the card without a lot first', () => {
    const [group] = toStockGroups(
      [
        summary('p1', [
          card('c1', { lot: { id: 'lb' } }),
          card('c2', { lot: { id: 'la' } }),
          card('c3'),
        ]),
      ],
      products,
      lots,
      true,
    );

    expect(group?.product).toEqual(product('p1'));
    expect(group?.cards.map((row) => row.stockCardId)).toEqual(['c3', 'c2', 'c1']);
    expect(group?.cards[1]?.lot).toEqual(lot('la', 'A-1'));
    expect(group?.cards[0]?.lot).toBeNull();
  });

  it('names a substitute card by its own product', () => {
    const [group] = toStockGroups(
      [summary('p1', [card('c1', { orderable: { id: 'p2' } })])],
      products,
      lots,
      true,
    );

    expect(group?.cards[0]?.product).toEqual(product('p2', 5));
  });

  it('leaves a product or lot the lookups did not list unnamed, never borrowing another', () => {
    const [group] = toStockGroups(
      [summary('gone', [card('c1', { orderable: { id: 'gone' }, lot: { id: 'missing' } })])],
      products,
      lots,
      true,
    );

    expect(group?.product).toBeUndefined();
    expect(group?.cards[0]?.product).toBeUndefined();
    expect(group?.cards[0]?.lot).toBeUndefined();
  });

  it('keeps inactive cards when they are included', () => {
    const [group] = toStockGroups(
      [summary('p1', [card('c1'), card('c2', { active: false })])],
      products,
      lots,
      true,
    );

    expect(group?.cards).toHaveLength(2);
  });

  it('hides inactive cards, and a product left with none, when they are not', () => {
    const groups = toStockGroups(
      [
        summary('p1', [card('c1'), card('c2', { active: false })]),
        summary('p2', [card('c3', { orderable: { id: 'p2' }, active: false })]),
      ],
      products,
      lots,
      false,
    );

    expect(groups.map((group) => group.id)).toEqual(['p1']);
    expect(groups[0]?.cards.map((row) => row.stockCardId)).toEqual(['c1']);
  });

  it('keeps the server order of products, and zero and negative balances', () => {
    const groups = toStockGroups(
      [
        summary('p2', [card('c1', { orderable: { id: 'p2' }, stockOnHand: -4 })], -4),
        summary('p1', [card('c2', { stockOnHand: 0 })], 0),
      ],
      products,
      lots,
      true,
    );

    expect(groups.map((group) => [group.id, group.stockOnHand])).toEqual([
      ['p2', -4],
      ['p1', 0],
    ]);
  });
});
