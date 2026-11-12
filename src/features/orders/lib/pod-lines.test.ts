import { expect, it } from 'vitest';
import { groupPodLines } from '@/features/orders/lib/pod-lines';
import type { PodLine } from '@/features/orders/lib/pod-types';

const line = (id: string, product: string, lot: string | null = null): PodLine => ({
  id,
  orderable: { id: product, versionNumber: 1 },
  lot: lot ? { id: lot } : null,
  quantityAccepted: null,
  quantityRejected: 0,
  useVvm: false,
  vvmStatus: null,
  rejectionReasonId: null,
  notes: null,
});
it('groups substitutes, collapses self fulfilment and retains unmatched products and missing shipment quantities', () => {
  const lines = [line('self', 'a'), line('sub', 'b', 'lot'), line('other', 'c')];
  const groups = groupPodLines(
    [{ orderable: { id: 'a', fullProductName: 'Zulu' }, orderedQuantity: 10 }],
    lines,
    [
      { orderable: { id: 'b' }, lot: { id: 'lot' }, quantityShipped: 7 },
      { orderable: { id: 'b' }, lot: null, quantityShipped: 99 },
    ],
    { a: { canFulfillForMe: ['a', 'b'] } },
    [
      { id: 'a', fullProductName: 'Zulu' },
      { id: 'b', fullProductName: 'Alpha' },
      { id: 'c', fullProductName: 'Other' },
    ],
  );
  expect(groups).toHaveLength(2);
  expect(groups[0].products.map((p) => [p.product.id, p.collapsed])).toEqual([
    ['b', false],
    ['a', true],
  ]);
  expect(groups[0].products[0].lines[0].quantityShipped).toBe(7);
  expect(groups[0].products[1].lines[0].quantityShipped).toBeNull();
  expect(groups[1].orderLine).toBeNull();
  expect(groups[1].products[0].lines[0].id).toBe('other');
});
it('sorts order groups by product name and retains each lot line once', () => {
  const groups = groupPodLines(
    [
      { orderable: { id: 'z', fullProductName: 'Zulu' }, orderedQuantity: 1 },
      { orderable: { id: 'a', fullProductName: 'Alpha' }, orderedQuantity: 1 },
    ],
    [line('one', 'a', 'one'), line('two', 'a', 'two'), line('z-line', 'z')],
    [],
    {},
    [],
  );
  expect(groups.map((g) => g.orderLine?.orderable.id)).toEqual(['a', 'z']);
  expect(groups[0].products[0].lines.map((l) => l.id)).toEqual(['one', 'two']);
});

it('omits order groups without POD lines and retains actual deliveries even when zero was ordered', () => {
  const groups = groupPodLines(
    [
      { orderable: { id: 'empty-zero', fullProductName: 'A' }, orderedQuantity: 0 },
      { orderable: { id: 'empty-positive', fullProductName: 'B' }, orderedQuantity: 2 },
      { orderable: { id: 'delivered-zero', fullProductName: 'C' }, orderedQuantity: 0 },
      { orderable: { id: 'delivered', fullProductName: 'D' }, orderedQuantity: 1 },
    ],
    [line('delivery', 'delivered'), line('extra-delivery', 'delivered-zero')],
    [],
    {},
    [],
  );
  expect(groups.map((group) => group.orderLine?.orderable.id)).toEqual([
    'delivered-zero',
    'delivered',
  ]);
  expect(
    groups.flatMap((group) => group.products.flatMap((product) => product.lines)),
  ).toHaveLength(2);
});

it('shows shared substitutes in each ordered group and keeps only unmatched lines in Other Products', () => {
  const shared = line('substitute-lot', 'substitute', 'lot');
  const groups = groupPodLines(
    [
      { orderable: { id: 'a', fullProductName: 'Alpha' }, orderedQuantity: 1 },
      { orderable: { id: 'b', fullProductName: 'Beta' }, orderedQuantity: 2 },
    ],
    [shared, line('unmatched', 'other')],
    [{ orderable: { id: 'substitute' }, lot: { id: 'lot' }, quantityShipped: 3 }],
    { a: { canFulfillForMe: ['substitute'] }, b: { canFulfillForMe: ['substitute'] } },
    [],
  );
  expect(
    groups.map((group) =>
      group.products.flatMap((product) => product.lines.map((item) => item.id)),
    ),
  ).toEqual([['substitute-lot'], ['substitute-lot'], ['unmatched']]);
});
