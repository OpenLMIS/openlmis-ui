import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ShipmentGrid } from '@/features/orders/components/shipment-grid';
import { shipmentValues, useShipmentForm } from '@/features/orders/lib/shipment-form';
import { buildShipmentLines } from '@/features/orders/lib/shipment-lines';
import { creatingOrder, orderProduct } from '@/test-utils/order-fixtures';

const layout = vi.hoisted(() => ({ cards: false }));
vi.mock('@/hooks/use-card-view', () => ({
  useCardLayout: () => ({ cards: layout.cards, measure: () => {} }),
}));
const commodity = {
  ...orderProduct,
  id: 'commodity',
  productCode: 'C',
  fullProductName: 'Commodity',
};
const order = {
  ...creatingOrder(),
  orderLineItems: [
    { orderable: orderProduct, orderedQuantity: 2 },
    { orderable: commodity, orderedQuantity: 1 },
  ],
};
const card = {
  orderable: { id: 'product' },
  lot: { id: 'lot' },
  stockOnHand: 200,
  stockCard: { id: 'card' },
  active: true,
};
const lines = buildShipmentLines({
  orderLines: order.orderLineItems,
  summaries: ['product', 'commodity'].map((id) => ({
    orderable: { id },
    stockOnHand: 200,
    canFulfillForMe: [card],
  })),
  products: [orderProduct, commodity],
  lots: [{ id: 'lot', lotCode: 'LOT' }],
});
function Harness() {
  const form = useShipmentForm(shipmentValues(lines));
  return (
    <ShipmentGrid
      form={form}
      order={order}
      lines={lines}
      unit="PACKS"
      canEdit
      disabled={false}
      attempted={false}
    />
  );
}
it.each([false, true])(
  'edits a shared lot once and mirrors its fill in cards=%s',
  async (cards) => {
    layout.cards = cards;
    render(<Harness />);
    const ids = Array.from(document.querySelectorAll('[id]'), (node) => node.id);
    expect(ids).toHaveLength(new Set(ids).size);
    const input = screen.getByRole('textbox', { name: 'orders.shipment.fill-label' });
    fireEvent.change(input, { target: { value: '3' } });
    await waitFor(() => expect(screen.getAllByText('3')).toHaveLength(3));
  },
);
it.each([false, true])(
  'excludes malformed fill text from shown totals in cards=%s',
  async (cards) => {
    layout.cards = cards;
    render(<Harness />);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '1.5' } });
    expect(screen.queryByText('1.5')).not.toBeInTheDocument();
    expect(screen.queryByText('18.5')).not.toBeInTheDocument();
  },
);
