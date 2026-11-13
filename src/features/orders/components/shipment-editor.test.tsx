import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { StrictMode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  createShipmentDraftOnce,
  deleteShipmentDraft,
  fetchOrder,
  fetchShipmentSummaries,
  findShipmentDraft,
  saveShipmentDraft,
} from '@/features/orders/api/api';
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
import { fetchLotsByIds } from '@/features/reference-data/api/api';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { creatingOrder, orderProduct } from '@/test-utils/order-fixtures';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/orders/api/api', async (original) => ({
  ...(await original<typeof import('@/features/orders/api/api')>()),
  createShipmentDraftOnce: vi.fn(),
  deleteShipmentDraft: vi.fn(),
  fetchOrder: vi.fn(),
  fetchShipmentSummaries: vi.fn(),
  findShipmentDraft: vi.fn(),
  saveShipmentDraft: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', async (original) => ({
  ...(await original<typeof import('@/features/reference-data/api/api')>()),
  fetchLotsByIds: vi.fn(),
}));
vi.mock('@/hooks/use-quantity-unit', () => ({
  useQuantityUnit: () => ({ unit: 'PACKS', canSwitch: false, setUnit: vi.fn() }),
}));
const print = vi.hoisted(() => ({ before: undefined as undefined | (() => Promise<boolean>) }));
vi.mock('@/hooks/use-print-report', () => ({
  usePrintReport: (options: { beforeRequest: () => Promise<boolean> }) => {
    print.before = options.beforeRequest;
    return { isPending: false, print: vi.fn() };
  },
}));
beforeEach(() => vi.clearAllMocks());
const refusalMessage =
  'You do not have permission STOCK_CARDS_VIEW for program Family Planning facility Ntcheu District Warehouse to perform this action.';
function stockRefusal() {
  return new AxiosError<{ message: string }>(
    'Request failed with status code 403',
    'ERR_BAD_REQUEST',
    undefined,
    null,
    {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {
        message: refusalMessage,
      },
    },
  );
}
function fixture(status: string, edit = false, onReturn = vi.fn()) {
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
  vi.mocked(fetchOrder).mockResolvedValue(order);
  vi.mocked(fetchShipmentSummaries).mockResolvedValue(summaries);
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
        onReturn={onReturn}
      />
    </StrictMode>
  );
  return { client, page, record, summaries, order };
}
it.each(['stock', 'draft'] as const)(
  'explains a refused %s read, stays blocked after Close, and recovers through Try Again',
  async (read) => {
    const { client, page, record, summaries, order } = fixture('FULFILLING', true);
    const options =
      read === 'stock'
        ? shipmentSummariesOptions(shipmentStockFilter(order))
        : shipmentDraftOptions(order.id);
    const request = Promise.withResolvers<never>();
    const pending = client
      .fetchQuery({ queryKey: options.queryKey, staleTime: 0, queryFn: () => request.promise })
      .catch(() => {});
    const refusal = stockRefusal();
    vi.mocked(findShipmentDraft).mockResolvedValue(record);
    vi.mocked(fetchShipmentSummaries).mockResolvedValue(summaries);
    const user = userEvent.setup();
    renderPage(page, { queryClient: client });
    await screen.findByRole('heading', { name: 'orders.shipment.title' });
    await act(async () => {
      request.reject(refusal);
      await pending;
    });
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(refusalMessage);
    await user.click(within(dialog).getByRole('button', { name: 'dialog.close' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByText(refusalMessage)).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'orders.shipment.save' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('textbox')).toHaveValue('2');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  },
);
it('does not create an Ordered draft from cached stock after the entry stock read is refused', async () => {
  const { client, page, order } = fixture('ORDERED', true);
  const request = Promise.withResolvers<never>();
  const options = shipmentSummariesOptions(shipmentStockFilter(order));
  const pending = client
    .fetchQuery({ ...options, staleTime: 0, queryFn: () => request.promise })
    .catch(() => {});
  vi.mocked(createShipmentDraftOnce).mockImplementation(() => new Promise(() => {}));
  renderPage(page, { queryClient: client });
  await screen.findByRole('heading', { name: 'orders.shipment.title' });
  await act(async () => {
    request.reject(stockRefusal());
    await pending;
  });
  await screen.findByText('orders.shipment.stock-error');
  expect(createShipmentDraftOnce).not.toHaveBeenCalled();
  expect(client.getQueryState(options.queryKey)?.status).toBe('error');
});
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
it('does not recreate a draft while returning after Delete Draft', async () => {
  const { client, page } = fixture(
    'FULFILLING',
    true,
    vi.fn(() => new Promise(() => {})),
  );
  vi.mocked(deleteShipmentDraft).mockResolvedValue(undefined);
  vi.mocked(fetchOrder).mockResolvedValue({ ...creatingOrder(), status: 'ORDERED' });
  vi.mocked(findShipmentDraft).mockResolvedValue(null);
  const user = userEvent.setup();
  renderPage(page, { queryClient: client });
  await user.click(await screen.findByRole('button', { name: 'orders.shipment.delete' }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'orders.shipment.delete' }));
  await waitFor(() =>
    expect(client.getQueryData(orderOptions('a').queryKey)?.status).toBe('ORDERED'),
  );
  await waitFor(() => expect(findShipmentDraft).toHaveBeenCalled());
  await act(async () => {});
  expect(createShipmentDraftOnce).not.toHaveBeenCalled();
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

it('waits for the entry draft refresh before allowing a save of cached quantities', async () => {
  const { client, page, record } = fixture('FULFILLING', true);
  const fresh = { ...record, lineItems: [{ ...record.lineItems[0], quantityShipped: 7 }] };
  const request = Promise.withResolvers<typeof record>();
  const pending = client.fetchQuery({
    ...shipmentDraftOptions('a'),
    staleTime: 0,
    queryFn: () => request.promise,
  });
  vi.mocked(findShipmentDraft).mockResolvedValue(fresh);
  vi.mocked(saveShipmentDraft).mockResolvedValue(fresh);
  renderPage(page, { queryClient: client });
  await screen.findByRole('heading', { name: 'orders.shipment.title' });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await act(async () => {
    request.resolve(fresh);
    await pending;
  });
  expect(await screen.findByRole('textbox')).toHaveValue('7');
  await userEvent.setup().click(screen.getByRole('button', { name: 'orders.shipment.save' }));
  await waitFor(() => expect(saveShipmentDraft).toHaveBeenCalledOnce());
  expect(vi.mocked(saveShipmentDraft).mock.calls[0][0].lineItems[0].quantityShipped).toBe(7);
});

it('retains typed fills through a failed stock refresh and recovery', async () => {
  const { client, page, summaries, order } = fixture('FULFILLING', true);
  renderPage(page, { queryClient: client });
  const input = await screen.findByRole('textbox');
  fireEvent.change(input, { target: { value: '7' } });
  await act(async () => {
    await client
      .fetchQuery({
        ...shipmentSummariesOptions(shipmentStockFilter(order)),
        staleTime: 0,
        queryFn: async () => {
          throw new Error('stock lookup failed');
        },
      })
      .catch(() => {});
  });
  expect(screen.getByRole('textbox')).toBe(input);
  expect(input).toHaveValue('7');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'orders.shipment.confirm' })).toBeDisabled(),
  );
  await act(async () => {
    client.setQueryData(shipmentSummariesOptions(shipmentStockFilter(order)).queryKey, summaries);
  });
  expect(screen.getByRole('textbox')).toHaveValue('7');
});

it('keeps a zero-stock lot input visible while its fill is blank or malformed', async () => {
  const { client, page, record, summaries, order } = fixture('FULFILLING', true);
  const lots = [{ id: 'lot', lotCode: 'Lot A', expirationDate: null }];
  const zero = [
    {
      ...summaries[0],
      stockOnHand: 0,
      canFulfillForMe: [{ ...summaries[0].canFulfillForMe[0], lot: { id: 'lot' }, stockOnHand: 0 }],
    },
  ];
  const draft = { ...record, lineItems: [{ ...record.lineItems[0], lot: { id: 'lot' } }] };
  client.setQueryData(shipmentSummariesOptions(shipmentStockFilter(order)).queryKey, zero);
  client.setQueryData(shipmentDraftOptions('a').queryKey, draft);
  client.setQueryData(shipmentSavedProductsOptions(draft.lineItems).queryKey, [orderProduct]);
  client.setQueryData(shipmentLotsOptions(zero, draft.lineItems).queryKey, lots);
  client.setQueryData(shipmentLotsOptions(zero).queryKey, lots);
  renderPage(page, { queryClient: client });
  const input = await screen.findByRole('textbox');
  fireEvent.change(input, { target: { value: '' } });
  expect(screen.getByRole('textbox')).toBe(input);
  fireEvent.change(input, { target: { value: 'bad' } });
  expect(screen.getByRole('textbox')).toBe(input);
  expect(screen.queryAllByText('NaN')).toHaveLength(0);
  fireEvent.change(input, { target: { value: '0' } });
  await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
});

it('blocks allocation until named lots load and exposes a retry on lot lookup failure', async () => {
  const { client, page, record, summaries, order } = fixture('FULFILLING', true);
  const stocked = [
    {
      ...summaries[0],
      canFulfillForMe: [{ ...summaries[0].canFulfillForMe[0], lot: { id: 'lot' } }],
    },
  ];
  const draft = { ...record, lineItems: [{ ...record.lineItems[0], lot: { id: 'lot' } }] };
  client.setQueryData(shipmentSummariesOptions(shipmentStockFilter(order)).queryKey, stocked);
  client.setQueryData(shipmentDraftOptions('a').queryKey, draft);
  client.setQueryData(shipmentSavedProductsOptions(draft.lineItems).queryKey, [orderProduct]);
  const query = shipmentLotsOptions(stocked, draft.lineItems);
  const request =
    Promise.withResolvers<
      {
        id: string;
        lotCode: string;
        expirationDate: null;
        manufactureDate: null;
        tradeItemId: string;
      }[]
    >();
  const pending = client.fetchQuery({ ...query, queryFn: () => request.promise });
  renderPage(page, { queryClient: client });
  await screen.findByRole('heading', { name: 'orders.shipment.title' });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await act(async () => {
    request.reject(new Error('lots forbidden'));
    await pending.catch(() => {});
  });
  expect(await screen.findByText('orders.shipment.load-error')).toBeVisible();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  vi.mocked(fetchLotsByIds).mockResolvedValue([
    { id: 'lot', lotCode: 'Lot A', expirationDate: null },
  ]);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Try Again' }));
  await waitFor(() => expect(fetchLotsByIds).toHaveBeenCalledWith(['lot']));
  expect(await screen.findByRole('textbox')).toHaveValue('2');
  expect(screen.getByText('Lot A')).toBeVisible();
});

it('keeps quantity typing and focus through Save and the following stock refresh', async () => {
  const { client, page, record, order, summaries } = fixture('FULFILLING', true);
  const saved = { ...record, lineItems: [{ ...record.lineItems[0], quantityShipped: 3 }] };
  const response = Promise.withResolvers<typeof record>();
  const refresh = Promise.withResolvers<typeof summaries>();
  vi.mocked(findShipmentDraft).mockResolvedValue(record);
  vi.mocked(saveShipmentDraft).mockReturnValue(response.promise);
  vi.mocked(fetchShipmentSummaries).mockReturnValue(refresh.promise);
  const user = userEvent.setup();
  renderPage(page, { queryClient: client });
  const input = await screen.findByRole('textbox');
  fireEvent.change(input, { target: { value: '3' } });
  await user.click(screen.getByRole('button', { name: 'orders.shipment.save' }));
  await waitFor(() => expect(saveShipmentDraft).toHaveBeenCalledOnce());
  await user.click(input);
  fireEvent.change(input, { target: { value: '7' } });
  await act(async () => response.resolve(saved));
  await waitFor(() =>
    expect(
      client.getQueryState(shipmentSummariesOptions(shipmentStockFilter(order)).queryKey)
        ?.fetchStatus,
    ).toBe('fetching'),
  );
  expect(input).toBeEnabled();
  expect(screen.getByRole('button', { name: 'orders.shipment.save' })).toBeDisabled();
  expect(input).toHaveFocus();
  await user.type(input, '8');
  expect(input).toHaveValue('78');
  await act(async () => refresh.resolve(summaries));
  expect(input).toHaveValue('78');
});

it('offers recovery when a Fulfilling draft disappeared after the order lookup', async () => {
  const { client, page } = fixture('FULFILLING', true);
  const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
  client.setQueryData(shipmentDraftOptions('a').queryKey, null);
  vi.mocked(findShipmentDraft).mockResolvedValue(null);
  const user = userEvent.setup();
  renderPage(page, { queryClient: client });
  expect(await screen.findByText('orders.shipment.draft-gone')).toBeVisible();
  expect(createShipmentDraftOnce).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Try Again' }));
  expect(reload).toHaveBeenCalledOnce();
});

it('saves the latest fills before allowing the pick pack list to print', async () => {
  const { client, page, record } = fixture('FULFILLING', true);
  const request = Promise.withResolvers<typeof record>();
  vi.mocked(findShipmentDraft).mockResolvedValue(record);
  vi.mocked(saveShipmentDraft).mockReturnValue(request.promise);
  renderPage(page, { queryClient: client });
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: '5' } });
  let ready = false;
  const printing = print.before?.().then((result) => {
    ready = result;
    return result;
  });
  await waitFor(() => expect(saveShipmentDraft).toHaveBeenCalledOnce());
  expect(vi.mocked(saveShipmentDraft).mock.calls[0][0].lineItems[0].quantityShipped).toBe(5);
  expect(ready).toBe(false);
  await act(async () =>
    request.resolve({ ...record, lineItems: [{ ...record.lineItems[0], quantityShipped: 5 }] }),
  );
  expect(await printing).toBe(true);
});
it('reveals the first visible invalid lot rather than the saved line order', async () => {
  const { client, page, record, summaries: original, order } = fixture('FULFILLING', true);
  const cards = ['later', 'earlier'].map((id) => ({
    ...original[0].canFulfillForMe[0],
    lot: { id },
  }));
  const summaries = [{ ...original[0], canFulfillForMe: cards }];
  const draft = {
    ...record,
    lineItems: cards.map((card) => ({
      ...record.lineItems[0],
      id: card.lot.id,
      lot: card.lot,
      quantityShipped: 0,
    })),
  };
  client.setQueryData(shipmentSummariesOptions(shipmentStockFilter(order)).queryKey, summaries);
  client.setQueryData(shipmentDraftOptions(order.id).queryKey, draft);
  client.setQueryData(shipmentSavedProductsOptions(draft.lineItems).queryKey, [orderProduct]);
  client.setQueryData(shipmentLotsOptions(summaries).queryKey, [
    { id: 'later', lotCode: 'Later', expirationDate: '2028-01-01' },
    { id: 'earlier', lotCode: 'Earlier', expirationDate: '2027-01-01' },
  ]);
  client.setQueryData(shipmentVvmOptions(summaries, [orderProduct]).queryKey, {});
  const user = userEvent.setup();
  renderPage(page, { queryClient: client });
  const inputs = await screen.findAllByRole('textbox');
  expect(inputs[0].id).toContain('earlier');
  for (const input of inputs) fireEvent.change(input, { target: { value: '' } });
  await user.click(screen.getByRole('button', { name: 'orders.shipment.confirm' }));
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'dialog.close' }),
  );
  await waitFor(() => expect(inputs[0]).toHaveFocus());
});
