import type { Order } from '@/features/orders/lib/types';

export const orderProduct = {
  id: 'product',
  productCode: 'CODE',
  fullProductName: 'Medicine',
  description: null,
  netContent: 10,
  meta: { versionNumber: 2 },
};
export function creatingOrder(id = 'a', quantity: number | null = 10): Order {
  return {
    id,
    status: 'CREATING',
    createdDate: '2026-01-01T12:00:00Z',
    program: { id: 'program', name: 'Program' },
    requestingFacility: { id: `facility-${id}`, name: `Facility ${id}` },
    receivingFacility: { id: `facility-${id}` },
    supplyingFacility: { id: 'supplier', name: 'Supplier' },
    orderLineItems: [{ id: `line-${id}`, orderable: orderProduct, orderedQuantity: quantity }],
  };
}
