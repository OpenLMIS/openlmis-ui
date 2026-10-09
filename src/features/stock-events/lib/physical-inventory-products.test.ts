import { expect, it } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import { buildInventoryLines } from '@/features/stock-events/lib/physical-inventory-lines';
import {
  addedInventoryLine,
  availableInventoryLots,
  canDeactivateInventoryLine,
  inventoryLotSchema,
  inventoryReasons,
} from '@/features/stock-events/lib/physical-inventory-products';

const orderable = {
  id: 'p',
  productCode: 'P',
  fullProductName: 'Product',
  description: null,
  identifiers: { tradeItem: 't' },
};
const stock = {
  orderable,
  lot: { id: 'l', lotCode: 'Batch', expirationDate: '2000-01-01' },
  stockOnHand: 0,
  stockCardId: 'c',
  active: true,
};
const listed = buildInventoryLines([stock], []);
it('offers expired lots and no lot but excludes listed lots', () => {
  const eligible = [stock, { ...stock, lot: null, stockCardId: null }];
  expect(availableInventoryLots(eligible, listed, 'p')).toEqual([eligible[1]]);
  expect(availableInventoryLots(eligible, [], 'p')).toEqual(eligible);
});
it('requires a new code, rejects duplicates without case, and accepts today and absent expiry', () => {
  const schema = inventoryLotSchema('p', listed, '2026-10-09');
  expect(schema.safeParse({ lotCode: '', expirationDate: '' }).success).toBe(false);
  expect(schema.safeParse({ lotCode: 'bAtCh', expirationDate: '' }).success).toBe(false);
  expect(schema.safeParse({ lotCode: 'New', expirationDate: '2026-10-08' }).success).toBe(false);
  expect(schema.safeParse({ lotCode: 'New', expirationDate: 'bad' }).success).toBe(false);
  expect(schema.safeParse({ lotCode: 'New', expirationDate: '2026-10-09' }).success).toBe(true);
  expect(schema.safeParse({ lotCode: 'New', expirationDate: '' }).success).toBe(true);
});
it('creates distinct new-lot keys, accepts zero, and marks additions active and deletable', () => {
  const a = addedInventoryLine(stock, quantityValue('0'), {
    clientId: 'a',
    lotCode: 'A',
    expirationDate: null,
    tradeItemId: 't',
  });
  const b = addedInventoryLine(stock, quantityValue('0'), {
    clientId: 'b',
    lotCode: 'B',
    expirationDate: null,
    tradeItemId: 't',
  });
  expect(a.key).toBe('p|new:a');
  expect(b.key).toBe('p|new:b');
  expect(a).toMatchObject({
    justAdded: true,
    isAdded: true,
    active: true,
    lot: null,
    stockCardId: null,
  });
});
it('permits deactivation only for an online active zero card not added this session', () => {
  expect(canDeactivateInventoryLine(listed[0], true)).toBe(true);
  for (const line of [
    { ...listed[0], active: false },
    { ...listed[0], justAdded: true },
    { ...listed[0], stockOnHand: 1 },
    { ...listed[0], stockCardId: null },
  ])
    expect(canDeactivateInventoryLine(line, true)).toBe(false);
  expect(canDeactivateInventoryLine(listed[0], false)).toBe(false);
});
it('offers nonhidden credit and debit reasons of every category', () => {
  const reason = (id: string, reasonType: string, reasonCategory = 'TRANSFER') => ({
    id,
    name: id,
    reasonType,
    reasonCategory,
    tags: [],
    isFreeTextAllowed: false,
  });
  expect(
    inventoryReasons([
      { hidden: false, reason: reason('credit', 'CREDIT') },
      { hidden: false, reason: reason('debit', 'DEBIT', 'ADJUSTMENT') },
      { hidden: true, reason: reason('hidden', 'CREDIT') },
      { hidden: false, reason: reason('balance', 'BALANCE_ADJUSTMENT') },
    ]).map((r) => r.id),
  ).toEqual(['credit', 'debit']);
});
