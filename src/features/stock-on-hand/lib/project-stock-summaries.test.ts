import { beforeEach, expect, it } from 'vitest';
import type { Orderable } from '@/features/reference-data/lib/types';
import { projectStockSummaries } from '@/features/stock-on-hand/lib/project-stock-summaries';
import type { StockCardSummariesQuery, StockCardSummary } from '@/features/stock-on-hand/lib/types';

const product = { id: 'o', productCode: 'ABC', fullProductName: 'Medicine', description: null };
const bundle = {
  userId: 'u',
  facilityId: 'home',
  programId: 'p',
  facilityTypeId: 'type',
  generation: 'g',
  formatVersion: 5,
  fetchedAt: 100,
  products: [product],
  cards: [
    {
      id: 'c',
      orderable: product,
      lot: { id: 'lot', lotCode: 'L1', expirationDate: null },
      stockOnHand: 7,
      active: false,
      occurredDate: '2026-01-01',
    },
  ],
  summaries: [
    {
      orderable: { id: 'o' },
      stockOnHand: 7,
      canFulfillForMe: [
        {
          stockCard: { id: 'c' },
          orderable: { id: 'o' },
          lot: { id: 'lot' },
          stockOnHand: 7,
          active: false,
          occurredDate: '2026-01-01',
        },
      ],
    },
  ],
};
const query = {
  facilityId: 'home',
  programId: 'p',
  nonEmptyOnly: true,
  page: 0,
  size: 10,
} as const;
let current: Omit<typeof bundle, 'summaries' | 'products'> & {
  summaries: StockCardSummary[];
  products: Orderable[];
} = bundle;

beforeEach(() => {
  current = { ...current, ...bundle };
});
const setBundle = (value: Pick<typeof current, 'summaries' | 'products' | 'cards'>) => {
  current = { ...current, ...value };
};
const project = (query: StockCardSummariesQuery) =>
  projectStockSummaries(
    current.summaries ?? [],
    current.products ?? [],
    current.cards.flatMap((card) => (card.lot ? [card.lot] : [])),
    query,
  );
it('filters and pages downloaded summaries with names, lots and inactive metadata intact', () => {
  const page = project({ ...query, orderableName: 'med', lotCode: 'l1' });
  expect(page.content).toEqual(bundle.summaries);
  expect(page.products).toEqual([product]);
  expect(project({ ...query, orderableCode: 'missing' }).totalElements).toBe(0);
  expect(project({ ...query, orderableName: 'missing' }).totalElements).toBe(0);
  expect(project({ ...query, lotCode: 'missing' }).totalElements).toBe(0);
  expect(project({ ...query, page: 1, size: 1 }).content).toEqual([]);
});
it('uses the newest product version for filtering and displayed stock metadata regardless of order', () => {
  const latest = {
    ...product,
    fullProductName: 'Latest Medicine',
    netContent: 20,
    meta: { versionNumber: 3 },
  };
  const older = {
    ...product,
    fullProductName: 'Older Name',
    netContent: 5,
    meta: { versionNumber: 1 },
  };
  for (const products of [
    [latest, older],
    [older, latest],
  ]) {
    setBundle({ ...bundle, products });
    const page = project({ ...query, orderableName: 'Latest' });
    expect(page.content).toEqual(bundle.summaries);
    expect(page.products).toEqual([latest]);
    expect(project({ ...query, orderableName: 'Older' }).totalElements).toBe(0);
  }
});

it.each([
  { balances: [7, 8], total: 15 },
  { balances: [null, null], total: null },
])('totals only matching lots, including unknown balances ($total)', ({ balances, total }) => {
  const entry = bundle.summaries[0].canFulfillForMe[0];
  setBundle({
    ...bundle,
    cards: [
      ...bundle.cards,
      {
        ...bundle.cards[0],
        id: 'c2',
        lot: { id: 'lot2', lotCode: 'L1-second', expirationDate: null },
      },
    ],
    summaries: [
      {
        ...bundle.summaries[0],
        stockOnHand: 99,
        canFulfillForMe: [
          ...balances.map((stockOnHand, index) => ({
            ...entry,
            stockCard: { id: index ? 'c2' : 'c' },
            lot: { id: index ? 'lot2' : 'lot' },
            stockOnHand,
          })),
          { ...entry, lot: null, stockOnHand: 92 },
        ],
      },
    ],
  });
  expect(project(query).content[0].stockOnHand).toBe(99);
  const page = project({ ...query, lotCode: 'L1' });
  expect(page.content[0].stockOnHand).toBe(total);
  expect(page.content[0].canFulfillForMe).toHaveLength(2);
});
