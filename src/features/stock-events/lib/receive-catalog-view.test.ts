import { expect, it } from 'vitest';
import type { Orderable } from '@/features/reference-data/lib/types';
import { stockKey } from '@/features/stock-events/lib/event-reverse';
import type { HomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import type { ReceiveCatalog } from '@/features/stock-events/lib/receive-catalog';
import {
  catalogApprovedPage,
  catalogLots,
  catalogScanCandidates,
  catalogStock,
  receiveCatalogView,
} from '@/features/stock-events/lib/receive-catalog-view';
import { LocalDataUnavailableError } from '@/lib/local-data';

const product = (id: string, tradeItem = id): Orderable => ({
  id,
  productCode: id,
  fullProductName: `Product ${id}`,
  description: null,
  identifiers: { tradeItem },
});
const products = Array.from({ length: 120 }, (_, index) => product(String(index).padStart(3, '0')));
const catalog: ReceiveCatalog = {
  facilityId: 'home',
  facilityTypeId: 'type',
  programId: 'program',
  userId: 'user',
  generation: 'catalog',
  fetchedAt: 1,
  formatVersion: 1,
  scanning: true,
  approved: products.map(({ id }) => ({ id, versionNumber: null })),
  products: [...products, product('fulfiller', 'FULFIL')],
  fulfils: { '000': ['fulfiller'] },
  lots: [{ id: 'lot', lotCode: 'LOT', tradeItemId: '000', expirationDate: null }],
  tradeItems: [],
};
const bundle: HomeStockBundle = {
  facilityId: 'home',
  facilityTypeId: 'type',
  programId: 'program',
  userId: 'user',
  generation: 'stock',
  fetchedAt: 2,
  formatVersion: 6,
  scanning: true,
  cards: [],
  reasons: [],
  identities: [],
  tradeItems: [],
  products: [product('extra')],
  summaries: [
    {
      orderable: { id: 'extra' },
      stockOnHand: 7,
      canFulfillForMe: [
        {
          orderable: { id: 'extra' },
          stockCard: { id: 'card' },
          stockOnHand: 7,
          lot: null,
          active: true,
          occurredDate: null,
        },
      ],
    },
  ],
};

it('searches without case, pages the complete approved set and keeps deterministic ordering', () => {
  const view = receiveCatalogView(catalog, bundle);
  expect(catalogApprovedPage(view, 'PRODUCT 01', 0, 100).totalElements).toBe(10);
  expect(catalogApprovedPage(view, '', 0, 100)).toMatchObject({
    totalElements: 121,
    totalPages: 2,
    content: expect.any(Array),
  });
  expect(catalogApprovedPage(view, '', 0, 100).content).toHaveLength(100);
  expect(catalogApprovedPage(view, '', 1, 100).content).toHaveLength(21);
  expect(
    receiveCatalogView(
      {
        ...catalog,
        approved: catalog.approved.toReversed(),
        products: catalog.products.toReversed(),
      },
      bundle,
    ).approved,
  ).toEqual(view.approved);
  expect(view.approved.find(({ id }) => id === 'extra')?.orderable).toEqual(product('extra'));
  expect(catalogStock(view, ['000', 'extra'])).toEqual({ [stockKey('extra')]: 7 });
});

it('resolves direct and fulfiller scans, absence and ambiguity without case sensitivity', () => {
  const view = receiveCatalogView(catalog, bundle);
  expect(catalogScanCandidates(view, '000')).toEqual([
    { orderable: products[0], approvedId: '000' },
  ]);
  expect(catalogScanCandidates(view, 'fulfil')).toEqual([
    { orderable: product('fulfiller', 'FULFIL'), approvedId: '000' },
  ]);
  expect(catalogScanCandidates(view, 'missing')).toEqual([]);
  const ambiguous = receiveCatalogView(
    { ...catalog, products: [...catalog.products, product('001', '000')] },
    bundle,
  );
  expect(catalogScanCandidates(ambiguous, '000')).toHaveLength(2);
});

it('merges saved lots by id and rejects incomplete or older stock bundles', () => {
  const lot = catalog.lots[0];
  const view = receiveCatalogView(catalog, {
    ...bundle,
    cards: [
      { id: 'card', active: true, occurredDate: null, orderable: products[0], stockOnHand: 1, lot },
      {
        id: 'other',
        active: true,
        occurredDate: null,
        orderable: products[0],
        stockOnHand: 2,
        lot: { ...lot, id: 'other', tradeItemId: '000' },
      },
    ],
  });
  expect(catalogLots(view, ['000', '000'])).toHaveLength(2);
  expect(() => receiveCatalogView(catalog, { ...bundle, formatVersion: 5 })).toThrow(
    LocalDataUnavailableError,
  );
  expect(() => receiveCatalogView(catalog, { ...bundle, products: undefined })).toThrow(
    LocalDataUnavailableError,
  );
});
