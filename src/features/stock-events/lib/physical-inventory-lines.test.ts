import { describe, expect, it } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import {
  buildInventoryLines,
  filterInventoryLines,
  inventoryLineKey,
  inventoryPage,
  inventoryProgress,
} from '@/features/stock-events/lib/physical-inventory-lines';

const product = {
  id: 'p',
  productCode: 'C1',
  fullProductName: 'Aspirin',
  description: null,
  netContent: 10,
  dispensable: { displayUnit: 'Strip' },
  programs: [{ programId: 'program', orderableCategoryDisplayName: 'Medicines' }],
};
const stock = { orderable: product, lot: null, stockOnHand: 5, stockCardId: 'card', active: true };
const server = [{ orderableId: 'p', lotId: null, quantity: -1, stockAdjustments: [] }];
const lines = () => buildInventoryLines([stock], server);

describe('inventory line identities and merge', () => {
  it('distinguishes no lot, a saved lot and two new lots', () => {
    expect([
      inventoryLineKey('p'),
      inventoryLineKey('p', 'l'),
      inventoryLineKey('p', null, 'a'),
      inventoryLineKey('p', null, 'b'),
    ]).toEqual(['p|none', 'p|l', 'p|new:a', 'p|new:b']);
  });
  it('marks saved -1 as a member with a blank count and gives local changes precedence', () => {
    expect(lines()[0]).toMatchObject({ isAdded: true, quantity: { doses: '' } });
    const local = { ...lines()[0], quantity: quantityValue('9', 10), justAdded: true };
    expect(buildInventoryLines([stock], server, [local])[0]).toMatchObject({
      quantity: quantityValue('9', 10),
      justAdded: true,
    });
  });
  it('includes zero counts and reasons without a card and drops ineligible products only once loaded', () => {
    const stockless = { ...stock, stockCardId: null, stockOnHand: null };
    expect(buildInventoryLines([stockless], [])).toEqual([]);
    expect(buildInventoryLines([stockless], [{ orderableId: 'p', quantity: 0 }])).toHaveLength(1);
    expect(
      buildInventoryLines(
        [stockless],
        [
          {
            orderableId: 'p',
            stockAdjustments: [
              { reason: { id: 'r', name: 'Lost', reasonType: 'DEBIT' }, quantity: 1 },
            ],
          },
        ],
      ),
    ).toHaveLength(1);
    expect(buildInventoryLines([stock], server, [], [])).toEqual([]);
  });
});

describe('inventory display', () => {
  it('does not search a no-lot label when no product has a lot, as legacy', () => {
    expect(
      filterInventoryLines(lines(), { keyword: 'No Lot Defined' }, String, 'No Lot Defined'),
    ).toEqual([]);
  });
  const counted = {
    ...lines()[0],
    quantity: quantityValue('9', 10),
    lot: { id: 'l', lotCode: 'Batch', expirationDate: '2026-01-02' },
  };
  it.each([' c1 ', 'aspirin', 'strip', '5', '9', 'batch', '02/01/2026'])(
    'searches legacy fields: %s',
    (keyword) => {
      expect(filterInventoryLines([counted], { keyword }, () => '02/01/2026')).toEqual([counted]);
    },
  );
  it('hides only inactive zero balances and searches the no-lot label', () => {
    const inactive = { ...lines()[0], active: false, stockOnHand: 0 };
    expect(
      filterInventoryLines([inactive, { ...inactive, stockOnHand: 2 }], {}, String),
    ).toHaveLength(1);
    expect(filterInventoryLines([inactive], { includeInactive: true }, String)).toEqual([inactive]);
    expect(
      filterInventoryLines(
        [...lines(), counted],
        { keyword: 'No Lot Defined' },
        String,
        'No Lot Defined',
      ),
    ).toHaveLength(1);
  });
  it('pages whole products, orders no lot before lot codes and builds category bands', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      ...counted,
      key: String(i),
      orderable: { ...product, id: String(i), productCode: String(i).padStart(2, '0') },
    }));
    const page = inventoryPage(
      [...many, { ...many[0], key: 'no-lot', lot: null }],
      'program',
      1,
      20,
    );
    expect(page.total).toBe(21);
    expect(page.groups).toHaveLength(20);
    expect(page.groups[0].lines.map((line) => line.lot?.id ?? null)).toEqual([null, 'l']);
    expect(page.bands[0].category).toBe('Medicines');
    expect(inventoryPage(many, 'program', 99, 20)).toMatchObject({
      page: 2,
      groups: [expect.objectContaining({ orderable: expect.objectContaining({ id: '20' }) })],
    });
  });
  it('counts a product only when every displayed line is counted, including zero', () => {
    expect(inventoryProgress([counted, { ...lines()[0], key: 'blank' }])).toEqual({
      count: 0,
      total: 1,
    });
    expect(
      inventoryProgress([counted, { ...lines()[0], key: 'zero', quantity: quantityValue('0') }]),
    ).toEqual({ count: 1, total: 1 });
  });
});
