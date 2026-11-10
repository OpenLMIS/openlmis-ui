import { expect, it } from 'vitest';
import {
  groupQuantities,
  invalidShipmentPackSize,
  lineQuantities,
} from '@/features/orders/lib/shipment-quantities';

it.each([1, 10, 20, 84])('truncates whole packs at pack size %s', (nc) => {
  const packs = Math.floor(1000 / nc);
  expect(lineQuantities(1, 1000, 1, nc, 'PACKS')).toEqual({
    ordered: 1,
    fill: 1,
    available: packs,
    remaining: packs - 1,
  });
  expect(lineQuantities(1, 1000, 1, nc, 'DOSES')).toEqual({
    ordered: nc,
    fill: 1,
    available: packs * nc,
    remaining: (packs - 1) * nc,
  });
});
it('discards a partial pack, including seven doses at ten per pack', () => {
  expect(lineQuantities(0, 7, 0, 10, 'DOSES')).toEqual({
    ordered: 0,
    fill: 0,
    available: 0,
    remaining: 0,
  });
});
it('sums mixed packs in each unit but uses the group pack size for remaining doses', () => {
  const lines = [
    { stockOnHand: 27, fill: 1, netContent: 10 },
    { stockOnHand: 65, fill: 2, netContent: 20 },
  ];
  expect(groupQuantities(4, lines, 84, 'PACKS')).toEqual({
    ordered: 4,
    fill: 3,
    available: 5,
    remaining: 2,
  });
  expect(groupQuantities(4, lines, 84, 'DOSES')).toEqual({
    ordered: 336,
    fill: 3,
    available: 80,
    remaining: 168,
  });
});
it.each([0, null, undefined])(
  'displays an invalid pack size %s as one and blocks positive fill',
  (nc) => {
    expect(lineQuantities(2, 7, 1, nc, 'DOSES')).toEqual({
      ordered: 2,
      fill: 1,
      available: 7,
      remaining: 6,
    });
    expect(invalidShipmentPackSize(nc, 1)).toBe(true);
    expect(invalidShipmentPackSize(nc, 0)).toBe(false);
  },
);
