import { describe, expect, it } from 'vitest';
import { resolveScan, type ScanCard, type ScanLine } from '@/lib/stock-scan';

const orderable = { id: 'p1', identifiers: { tradeItem: 't1' } };
const card: ScanCard = {
  id: 'c1',
  stockOnHand: 50,
  orderable,
  lot: { id: 'l1', lotCode: 'LOT-A', expirationDate: '2027-01-31' },
};
const noLot: ScanCard = { ...card, id: 'c0', lot: null };
const product = { orderable, cards: [card, noLot] };
const scan = {
  gtin: '00012345678905',
  lotCode: 'lot-a',
  expiry: '2027-01-31',
  serial: 'same-pack',
};
const first: ScanLine = { key: 'first', orderable, lot: card.lot };
const resolve = (patch: Partial<Parameters<typeof resolveScan>[0]> = {}) =>
  resolveScan({
    scan,
    tradeItemId: 't1',
    products: [product],
    lines: [],
    policy: { allowsNewLot: false },
    ...patch,
  });

describe('resolveScan', () => {
  it('refuses a product absent from the supplied screen, including missing identifiers', () => {
    expect(resolve({ products: [] })).toEqual({
      type: 'refuse',
      reason: 'productNotOnScreen',
      params: { gtin: scan.gtin },
    });
    expect(resolve({ products: [{ orderable: { id: 'other' }, cards: [] }] }).type).toBe('refuse');
  });
  it('refuses multiple product matches, but many cards for one product are not ambiguous', () => {
    expect(
      resolve({ products: [product, { ...product, orderable: { ...orderable, id: 'p2' } }] }),
    ).toEqual({
      type: 'refuse',
      reason: 'productAmbiguous',
      params: { gtin: scan.gtin },
    });
    expect(resolve()).toEqual({ type: 'add', card });
  });
  it('matches case-insensitive lot codes without trimming and keeps expired and zero-SOH cards', () => {
    expect(resolve()).toEqual({ type: 'add', card });
    expect(resolve({ scan: { ...scan, lotCode: ' LOT-A ' } })).toEqual({
      type: 'refuse',
      reason: 'lotNotOnScreen',
      params: { lotCode: ' LOT-A ' },
    });
    const expired = {
      ...card,
      stockOnHand: 0,
      lot: { ...card.lot, lotCode: 'OLD', expirationDate: '2019-01-01' },
    };
    expect(
      resolve({
        scan: { gtin: scan.gtin, lotCode: 'old' },
        products: [{ orderable, cards: [expired] }],
      }),
    ).toEqual({ type: 'add', card: expired });
  });
  it('chooses the no-lot card when AI 10 is absent, or refuses a required lot', () => {
    expect(resolve({ scan: { gtin: scan.gtin } })).toEqual({ type: 'add', card: noLot });
    expect(
      resolve({ scan: { gtin: scan.gtin }, products: [{ orderable, cards: [card] }] }),
    ).toEqual({
      type: 'refuse',
      reason: 'lotRequired',
      params: {},
    });
  });
  it('refuses lots absent from Adjustment/Issue and allows a pending lot under an explicit policy', () => {
    expect(resolve({ scan: { ...scan, lotCode: 'NEW' } })).toEqual({
      type: 'refuse',
      reason: 'lotNotOnScreen',
      params: { lotCode: 'NEW' },
    });
    expect(resolve({ scan: { ...scan, lotCode: 'NEW' }, policy: { allowsNewLot: true } })).toEqual({
      type: 'add',
      card: {
        orderable,
        stockOnHand: 0,
        lot: { lotCode: 'NEW', expirationDate: '2027-01-31', tradeItemId: 't1' },
      },
    });
    expect(
      resolve({ scan: { gtin: scan.gtin, lotCode: 'NEW' }, policy: { allowsNewLot: true } }),
    ).toMatchObject({
      type: 'add',
      card: { lot: { expirationDate: null } },
    });
  });
  it('counts the first matching draft line by product and lot id, without serial deduplication', () => {
    const otherLot = { ...first, key: 'other-lot', lot: { id: 'l2', lotCode: 'LOT-A' } };
    const otherProduct = { ...first, key: 'other-product', orderable: { id: 'p2' } };
    expect(
      resolve({ lines: [otherLot, otherProduct, first, { ...first, key: 'duplicate' }] }),
    ).toEqual({ type: 'count', lineKey: 'first' });
    expect(
      resolve({ scan: { gtin: scan.gtin }, lines: [{ ...first, key: 'no-lot', lot: null }] }),
    ).toEqual({ type: 'count', lineKey: 'no-lot' });
  });
  it('matches repeated pending lot scans by code and never mixes pending with recorded ids', () => {
    const pending = { ...first, key: 'pending', lot: { lotCode: 'new' } };
    expect(
      resolve({
        scan: { ...scan, lotCode: 'NEW' },
        policy: { allowsNewLot: true },
        lines: [pending],
      }),
    ).toEqual({ type: 'count', lineKey: 'pending' });
    expect(resolve({ lines: [{ ...first, lot: { lotCode: 'lot-a' } }] })).toEqual({
      type: 'add',
      card,
    });
  });
  it('retains a pending lot expiry when a later scan disagrees, including an absent recorded expiry', () => {
    const pending = {
      ...first,
      key: 'pending',
      lot: { lotCode: 'new', expirationDate: '2027-01-31' },
    };
    const decision = resolve({
      scan: { ...scan, lotCode: 'NEW', expiry: '2027-02-28' },
      policy: { allowsNewLot: true },
      lines: [pending],
    });
    expect(decision).toEqual({
      type: 'confirm-expiry',
      recorded: '2027-01-31',
      scanned: '2027-02-28',
      next: { type: 'count', lineKey: 'pending' },
    });
    expect(
      resolve({
        scan: { ...scan, lotCode: 'NEW' },
        policy: { allowsNewLot: true },
        lines: [{ ...pending, lot: { lotCode: 'new', expirationDate: null } }],
      }),
    ).toEqual({ type: 'count', lineKey: 'pending' });
  });

  it('returns expiry confirmation with the original add or count action without changing inputs', () => {
    const before = structuredClone([product, first]);
    const changed = { ...scan, expiry: '2027-02-28' };
    expect(resolve({ scan: changed })).toEqual({
      type: 'confirm-expiry',
      recorded: '2027-01-31',
      scanned: '2027-02-28',
      next: { type: 'add', card },
    });
    expect(resolve({ scan: changed, lines: [first] })).toEqual({
      type: 'confirm-expiry',
      recorded: '2027-01-31',
      scanned: '2027-02-28',
      next: { type: 'count', lineKey: 'first' },
    });
    expect([product, first]).toEqual(before);
  });
  it('compares calendar dates from ISO strings and local Dates, and skips missing expiries', () => {
    for (const expiry of ['2027-01-31', '2027-01-31T20:00:00Z', new Date(2027, 0, 31, 23)]) {
      expect(
        resolve({
          scan: { ...scan, expiry },
          products: [
            {
              orderable,
              cards: [
                {
                  ...card,
                  lot: { ...card.lot, lotCode: 'LOT-A', expirationDate: new Date(2027, 0, 31) },
                },
              ],
            },
          ],
        }).type,
      ).toBe('add');
    }
    expect(resolve({ scan: { gtin: scan.gtin, lotCode: 'LOT-A' } }).type).toBe('add');
    expect(
      resolve({
        products: [
          { orderable, cards: [{ ...card, lot: { lotCode: 'LOT-A', expirationDate: null } }] },
        ],
      }).type,
    ).toBe('add');
  });
  it('can ignore scanned lot data for workflows that do not track lots', () => {
    expect(resolve({ policy: { allowsNewLot: false, tracksLots: false } })).toEqual({
      type: 'add',
      card: noLot,
    });
  });
});
