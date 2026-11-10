import { expect, it } from 'vitest';
import {
  shipmentConfirmBody,
  shipmentCreateBody,
  shipmentSaveBody,
} from '@/features/orders/lib/shipment-body';
import type { ShipmentLine } from '@/features/orders/lib/shipment-lines';

const lines: ShipmentLine[] = [
  {
    key: 'ui-key',
    id: 'line',
    orderedProductId: 'p',
    product: { id: 'p', meta: { versionNumber: 4 }, netContent: 10 },
    lot: { id: 'lot', lotCode: 'label' },
    stockOnHand: 100,
    fill: 3,
    stockCardId: 'card',
  },
];
it('creates with zero packs, exact versions and only API fields', () => {
  expect(shipmentCreateBody('order', lines)).toEqual({
    order: { id: 'order' },
    lineItems: [
      { orderable: { id: 'p', versionNumber: 4 }, lot: { id: 'lot' }, quantityShipped: 0 },
    ],
  });
});
it('saves line ids, null lots, notes and fills in packs without UI fields', () => {
  expect(
    shipmentSaveBody({ id: 'draft', order: { id: 'order' }, notes: 'keep' }, [
      ...lines,
      { ...lines[0], id: undefined, lot: null, fill: 0 },
    ]),
  ).toEqual({
    id: 'draft',
    order: { id: 'order' },
    notes: 'keep',
    lineItems: [
      {
        id: 'line',
        orderable: { id: 'p', versionNumber: 4 },
        lot: { id: 'lot' },
        quantityShipped: 3,
      },
      { orderable: { id: 'p', versionNumber: 4 }, lot: null, quantityShipped: 0 },
    ],
  });
});
it('confirms with the existing notes and pack quantities, excluding draft and line ids', () => {
  expect(
    shipmentConfirmBody({ id: 'draft', order: { id: 'order' }, notes: 'keep' }, lines),
  ).toEqual({
    order: { id: 'order' },
    notes: 'keep',
    lineItems: [
      { orderable: { id: 'p', versionNumber: 4 }, lot: { id: 'lot' }, quantityShipped: 3 },
    ],
  });
});
