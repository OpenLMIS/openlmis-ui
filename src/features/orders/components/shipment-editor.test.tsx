import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { createShipmentDraftOnce, fetchOrder } from '@/features/orders/api/api';
import {
  orderOptions,
  shipmentDraftOptions,
  shipmentLotsOptions,
  shipmentOptions,
  shipmentProductsOptions,
  shipmentSavedProductsOptions,
  shipmentSummariesOptions,
  shipmentVvmOptions,
} from '@/features/orders/api/queries';
import { ShipmentScreen, shipmentStockFilter } from '@/features/orders/components/shipment-editor';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { creatingOrder, orderProduct } from '@/test-utils/order-fixtures';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/orders/api/api', async (original) => ({
  ...(await original<typeof import('@/features/orders/api/api')>()),
  createShipmentDraftOnce: vi.fn(),
  fetchOrder: vi.fn(),
}));
vi.mock('@/hooks/use-quantity-unit', () => ({
  useQuantityUnit: () => ({ unit: 'PACKS', canSwitch: false, setUnit: vi.fn() }),
}));
vi.mock('@/hooks/use-print-report', () => ({
  usePrintReport: () => ({ isPending: false, print: vi.fn() }),
}));
beforeEach(() => vi.clearAllMocks());
function fixture(status: string, edit = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const order = { ...creatingOrder(), status };
  const summaries = [
    {
      orderable: { id: 'product' },
      stockOnHand: 100,
      canFulfillForMe: [
        { orderable: { id: 'product' }, stockCard: { id: 'card' }, stockOnHand: 100, active: true },
      ],
    },
  ];
  const record = {
    id: 'draft',
    order: { id: order.id },
    lineItems: [
      { id: 'line', orderable: { id: 'product', versionNumber: 2 }, lot: null, quantityShipped: 2 },
    ],
  };
  client.setQueryData(orderOptions(order.id).queryKey, order);
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  client.setQueryData(shipmentSummariesOptions(shipmentStockFilter(order)).queryKey, summaries);
  client.setQueryData(shipmentProductsOptions(summaries).queryKey, [orderProduct]);
  client.setQueryData(shipmentSavedProductsOptions([]).queryKey, []);
  client.setQueryData(shipmentSavedProductsOptions(record.lineItems).queryKey, [orderProduct]);
  client.setQueryData(shipmentLotsOptions(summaries).queryKey, []);
  client.setQueryData(shipmentVvmOptions(summaries, [orderProduct]).queryKey, {});
  client.setQueryData(
    shipmentDraftOptions(order.id).queryKey,
    status === 'ORDERED' ? null : record,
  );
  client.setQueryData(shipmentOptions(order.id).queryKey, null);
  const page = (
    <StrictMode>
      <ShipmentScreen
        orderId={order.id}
        cceStatus="Unknown"
        access={{ canEdit: edit, canCancel: false, canPrint: false }}
        onReturn={vi.fn()}
      />
    </StrictMode>
  );
  return { client, page, record };
}
it('creates an Ordered draft after render and keeps StrictMode effects from duplicating it', async () => {
  const { client, page, record } = fixture('ORDERED', true);
  vi.mocked(createShipmentDraftOnce).mockResolvedValue(record);
  vi.mocked(fetchOrder).mockResolvedValue({ ...creatingOrder(), status: 'FULFILLING' });
  renderPage(page, { queryClient: client });
  await screen.findByRole('textbox');
  expect(createShipmentDraftOnce).toHaveBeenCalledOnce();
  await waitFor(() =>
    expect(client.getQueryData(orderOptions('a').queryKey)?.status).toBe('FULFILLING'),
  );
});
it('gives a view-only user read-only lines and no shipment actions', async () => {
  const { client, page } = fixture('FULFILLING');
  renderPage(page, { queryClient: client });
  await screen.findByText(/Medicine/);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByText('orders.shipment.save')).not.toBeInTheDocument();
  expect(createShipmentDraftOnce).not.toHaveBeenCalled();
});
it.each(['CANCELLED', 'TRANSFER_FAILED'])(
  'shows a notice for %s without reading a draft',
  async (status) => {
    const { client, page } = fixture(status);
    client.removeQueries({ queryKey: shipmentDraftOptions('a').queryKey });
    renderPage(page, { queryClient: client });
    expect(await screen.findByText('orders.shipment.cannot-fulfill')).toBeVisible();
    await waitFor(() =>
      expect(client.getQueryState(shipmentDraftOptions('a').queryKey)).toBeUndefined(),
    );
    expect(createShipmentDraftOnce).not.toHaveBeenCalled();
  },
);

it('keeps fill errors hidden until blur, then follows corrections and blocks invalid Confirm', async () => {
  const { client, page } = fixture('FULFILLING', true);
  const user = userEvent.setup();
  renderPage(page, { queryClient: client });
  const input = await screen.findByRole('textbox');
  await user.clear(input);
  await user.type(input, '11');
  expect(input).toHaveAttribute('aria-invalid', 'false');
  await user.tab();
  await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
  await user.clear(input);
  await user.type(input, '3');
  await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'false'));
  await user.clear(input);
  await user.click(screen.getByRole('button', { name: 'orders.shipment.confirm' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('orders.shipment.invalid');
});
