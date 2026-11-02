import { describe, expect, it } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import {
  draftLines,
  isChanged,
  mergeSavedLines,
  orderBody,
  validLines,
} from '@/features/orders/lib/order-draft';
import type { Order } from '@/features/orders/lib/types';

const product = {
  id: 'p',
  productCode: 'P',
  fullProductName: 'Product',
  description: null,
  netContent: 10,
  meta: { versionNumber: 3 },
};
const order: Order = {
  id: 'o',
  status: 'CREATING',
  program: { id: 'program' },
  requestingFacility: { id: 'f' },
  receivingFacility: { id: 'f' },
  supplyingFacility: { id: 's' },
  orderLineItems: [{ id: 'saved', orderable: product, orderedQuantity: 15 }],
};
describe('order drafts', () => {
  it('sends doses with saved ids and exact product versions, leaving new lines without ids', () => {
    const lines = draftLines(order);
    lines.push({ ...lines[0], key: 'new', id: undefined, product: { ...product, id: 'new' } });
    expect(orderBody(order, lines).orderLineItems).toEqual([
      { id: 'saved', orderable: { id: 'p', meta: { versionNumber: 3 } }, orderedQuantity: 15 },
      { orderable: { id: 'new', meta: { versionNumber: 3 } }, orderedQuantity: 15 },
    ]);
    expect(orderBody(order, lines).receivingFacility).toEqual({ id: 'f' });
  });
  it('allows zero on save but requires positive quantities and a line on create', () => {
    const lines = draftLines(order);
    expect(validLines([], false)).toBe(true);
    expect(validLines([], true)).toBe(false);
    for (const value of ['', '-1', '1.5', '2147483648'])
      expect(validLines([{ ...lines[0], quantity: quantityValue(value, 10) }], false)).toBe(false);
    expect(validLines([{ ...lines[0], quantity: quantityValue('0', 10) }], false)).toBe(true);
    expect(validLines([{ ...lines[0], quantity: quantityValue('0', 10) }], true)).toBe(false);
  });
  it('merges ids only onto surviving client lines and preserves newer typing and markers', () => {
    const submitted = draftLines({
      ...order,
      orderLineItems: [{ orderable: product, orderedQuantity: 15 }],
    });
    const live = [{ ...submitted[0], quantity: quantityValue('22', 10) }];
    const merged = mergeSavedLines(live, submitted, order);
    expect(merged[0].id).toBe('saved');
    expect(merged[0].quantity.doses).toBe('22');
    expect(isChanged(merged, submitted)).toBe(true);
    expect(
      mergeSavedLines([{ ...live[0], key: 're-added' }], submitted, order)[0].id,
    ).toBeUndefined();
    expect(
      mergeSavedLines(
        [{ ...live[0], product: { ...product, meta: { versionNumber: 4 } } }],
        submitted,
        order,
      )[0].id,
    ).toBeUndefined();
    expect(isChanged(submitted, submitted)).toBe(false);
  });
});
