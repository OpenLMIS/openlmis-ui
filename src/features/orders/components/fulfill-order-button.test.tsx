import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { beforeEach, expect, it, vi } from 'vitest';
import { InCardContext } from '@/components/display/card-actions';
import {
  createShipmentDraftOnce,
  fetchOrder,
  fetchShipmentSummaries,
  findShipmentDraft,
} from '@/features/orders/api/api';
import { shipmentSummariesOptions } from '@/features/orders/api/queries';
import { FulfillOrderButton } from '@/features/orders/components/order-row-buttons';
import { shipmentStockFilter } from '@/features/orders/lib/shipment-entry';
import { creatingOrder, orderSummary } from '@/test-utils/order-fixtures';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/orders/api/api', async (original) => ({
  ...(await original<typeof import('@/features/orders/api/api')>()),
  fetchOrder: vi.fn(),
  fetchShipmentSummaries: vi.fn(),
  findShipmentDraft: vi.fn(),
  createShipmentDraftOnce: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchOrder).mockResolvedValue({ ...creatingOrder(), status: 'FULFILLING' });
  vi.mocked(findShipmentDraft).mockResolvedValue(null);
});

it.each(['ORDERED', 'FULFILLING'])(
  'waits for the %s order reads before navigating and preserves list return state',
  async (status) => {
    vi.mocked(fetchOrder).mockResolvedValue({ ...creatingOrder(), status });
    const stock = Promise.withResolvers<[]>();
    vi.mocked(fetchShipmentSummaries).mockReturnValue(stock.promise);
    const router = renderPage(
      <FulfillOrderButton
        order={{ ...orderSummary('a'), status }}
        search={{ page: 3 }}
        disabled={false}
      />,
    );
    const action = await screen.findByLabelText('orders.action-for');
    const user = userEvent.setup();
    await user.click(action);
    expect(router.state.location.pathname).toBe('/');
    await waitFor(() => expect(fetchShipmentSummaries).toHaveBeenCalledOnce());
    expect(action).toBeDisabled();
    expect(router.state.location.pathname).toBe('/');
    await user.click(action);
    expect(fetchOrder).toHaveBeenCalledOnce();
    stock.resolve([]);
    await waitFor(() =>
      expect(router.state.location.state.orderReturn).toEqual({
        to: '/orders/fulfillment',
        search: { page: 3 },
      }),
    );
    expect(router.state.location.pathname).toBe('/orders/fulfillment/a');
    expect(createShipmentDraftOnce).not.toHaveBeenCalled();
  },
);

it.each([false, true])(
  'keeps the list URL, page and filters when stock access is refused (cards: %s)',
  async (cards) => {
    const message =
      'You do not have permission STOCK_CARDS_VIEW for program Family Planning facility Ntcheu District Warehouse to perform this action.';
    vi.mocked(fetchShipmentSummaries).mockRejectedValue(
      new AxiosError('Forbidden', undefined, undefined, undefined, {
        status: 403,
        data: { message },
      } as never),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(
      shipmentSummariesOptions(shipmentStockFilter(creatingOrder())).queryKey,
      [],
    );
    const path = '/orders/fulfillment?page=3&programId=program';
    const router = renderPage(
      <InCardContext value={cards}>
        <FulfillOrderButton
          order={orderSummary('a')}
          search={{ page: 3, programId: 'program' }}
          disabled={false}
        />
      </InCardContext>,
      { path, queryClient: client },
    );
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('orders.action-for'));
    expect(router.state.location.href).toBe(path);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(message);
    expect(dialog).toHaveTextContent('orders.shipment.not-authorized');
    expect(router.state.location.href).toBe(path);
    expect(createShipmentDraftOnce).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'dialog.close' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(router.state.location.href).toBe(path);
    expect(screen.getByRole('button')).toBeEnabled();
    await waitFor(() => expect(screen.getByRole('button')).toHaveFocus());
  },
);
