import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteOrders, fetchOrder, saveOrder, sendOrder } from '@/features/orders/api/api';
import { OrderEditor } from '@/features/orders/components/order-editor';
import type { Order } from '@/features/orders/lib/types';
import {
  approvedProductsOptions,
  deploymentTimeZoneOptions,
} from '@/features/reference-data/api/queries';
import { Route } from '@/routes/(protected)/_protected.requisitions.create-orders_.$orderIds';
import { creatingOrder } from '@/test-utils/order-fixtures';

vi.mock('@/features/auth/lib/access', () => ({ requirePermissions: vi.fn(async () => ({})) }));
vi.mock('@/components/app-shell/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));
vi.mock('@/hooks/use-discard-guard', () => ({
  useDiscardGuard: () => ({
    dialog: { open: false, signingOut: false, onDiscard: vi.fn(), onKeepEditing: vi.fn() },
  }),
}));
vi.mock('@/hooks/use-quantity-unit', () => ({
  useQuantityUnit: () => ({ unit: 'DOSES', setUnit: vi.fn(), canSwitch: false }),
}));
vi.mock('@/features/orders/api/api', () => ({
  saveOrder: vi.fn(),
  sendOrder: vi.fn(),
  deleteOrders: vi.fn(),
  fetchOrder: vi.fn(),
  fetchOrderStockOnHand: vi.fn(async () => []),
}));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
function setup(orders = [creatingOrder('a'), creatingOrder('b')]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  for (const order of orders)
    client.setQueryData(
      approvedProductsOptions({
        programId: order.program.id,
        facilityId: order.requestingFacility.id,
        name: '',
        page: 0,
        size: 50,
      }).queryKey,
      {
        content: [{ id: 'approved', orderable: order.orderLineItems[0].orderable }],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 50,
      },
    );
  let changeBatch: (ids: string[]) => void;
  const onBatchChange = vi.fn(async (ids: string[]) => changeBatch(ids));
  function Harness() {
    const [tab, onTab] = useState('a');
    const [ids, setIds] = useState(orders.map((order) => order.id));
    changeBatch = setIds;
    return (
      <OrderEditor
        entries={orders
          .filter((order) => ids.includes(order.id))
          .map((order) => ({ id: order.id, order }))}
        tab={tab}
        onTab={onTab}
        onBatchChange={onBatchChange}
        onCancel={vi.fn()}
      />
    );
  }
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), onBatchChange };
}
function quantity() {
  return screen.getByRole('textbox', { name: /orders.edit.quantity Medicine/ });
}
describe('order editor workflow', () => {
  it('keeps edits across tabs and saves only changed orders while newer typing stays unsaved', async () => {
    const deferred = Promise.withResolvers<Order>();
    vi.mocked(saveOrder).mockReturnValue(deferred.promise);
    const { user } = setup();
    fireEvent.change(quantity(), { target: { value: '25' } });
    await user.click(screen.getByRole('tab', { name: /Facility b/ }));
    expect(quantity()).toHaveValue('10');
    await user.click(screen.getByRole('tab', { name: /Facility a/ }));
    expect(quantity()).toHaveValue('25');
    await user.click(screen.getByRole('button', { name: 'orders.edit.save-draft' }));
    await waitFor(() => expect(saveOrder).toHaveBeenCalledOnce());
    expect(saveOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a',
        receivingFacility: { id: 'facility-a' },
        orderLineItems: [
          {
            id: 'line-a',
            orderable: { id: 'product', meta: { versionNumber: 2 } },
            orderedQuantity: 25,
          },
        ],
      }),
    );
    expect(screen.getByRole('button', { name: 'orders.edit.create' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'orders.edit.delete-order' })).toBeDisabled();
    fireEvent.change(quantity(), { target: { value: '30' } });
    await act(async () =>
      deferred.resolve({
        ...creatingOrder('a'),
        orderLineItems: [{ ...creatingOrder('a').orderLineItems[0], orderedQuantity: 25 }],
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'orders.edit.save-draft' })).toBeEnabled(),
    );
    expect(quantity()).toHaveValue('30');
    expect(screen.getByRole('tab', { name: /Facility a/ })).toHaveTextContent(
      'orders.edit.unsaved',
    );
  });
  it('does not attach a saved line id to a product removed and re-added while saving', async () => {
    const response = Promise.withResolvers<Order>();
    vi.mocked(saveOrder).mockReturnValueOnce(response.promise);
    const { user } = setup();
    fireEvent.change(quantity(), { target: { value: '25' } });
    await user.click(screen.getByRole('button', { name: 'orders.edit.save-draft' }));
    await waitFor(() => expect(saveOrder).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button', { name: 'orders.edit.remove-line' }));
    await user.click(screen.getByRole('combobox', { name: 'orders.edit.select-product' }));
    await user.click(await screen.findByRole('option', { name: 'Medicine' }));
    await user.click(screen.getByRole('button', { name: 'orders.add' }));
    fireEvent.change(quantity(), { target: { value: '35' } });
    await act(async () => response.resolve(creatingOrder('a', 25)));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'orders.edit.save-draft' })).toBeEnabled(),
    );
    vi.mocked(saveOrder).mockResolvedValue(creatingOrder('a', 35));
    await user.click(screen.getByRole('button', { name: 'orders.edit.save-draft' }));
    await waitFor(() => expect(saveOrder).toHaveBeenCalledTimes(2));
    expect(vi.mocked(saveOrder).mock.calls[1][0].orderLineItems).toEqual([
      { orderable: { id: 'product', meta: { versionNumber: 2 } }, orderedQuantity: 35 },
    ]);
  });
  it('requires every tab to be valid, summarizes both, and removes only a successful send', async () => {
    const { user, onBatchChange } = setup([creatingOrder('a'), creatingOrder('b', 0)]);
    expect(screen.getByRole('button', { name: 'orders.edit.create' })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: /Facility b/ }));
    fireEvent.change(quantity(), { target: { value: '15' } });
    vi.mocked(sendOrder)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Failed'));
    vi.mocked(fetchOrder).mockResolvedValue(creatingOrder('b'));
    await user.click(screen.getByRole('button', { name: 'orders.edit.create' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Facility a')).toBeVisible();
    expect(within(dialog).getByText('Facility b')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'orders.edit.summary-confirm' }));
    await waitFor(() => expect(onBatchChange).toHaveBeenCalledWith(['b']));
    expect(sendOrder).toHaveBeenCalledTimes(2);
    expect(quantity()).toHaveValue('15');
    expect(screen.getByRole('tab', { name: /Facility b/ })).toHaveTextContent(
      'orders.edit.unsaved',
    );
  });
  it('confirms Delete Batch, deletes every id and leaves the batch', async () => {
    vi.mocked(deleteOrders).mockResolvedValue(undefined);
    const { user, onBatchChange } = setup();
    await user.click(screen.getByRole('button', { name: 'orders.edit.delete-batch' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'orders.edit.delete-batch',
      }),
    );
    await waitFor(() => expect(onBatchChange).toHaveBeenCalledWith([]));
    expect(deleteOrders).toHaveBeenCalledWith(['a', 'b']);
  });
  it('keeps the whole batch after a delete 404 and blocks the order no longer Creating', async () => {
    vi.mocked(deleteOrders).mockRejectedValue(
      new AxiosError('Changed', undefined, undefined, undefined, {
        status: 404,
        data: { message: 'Order a changed' },
      } as never),
    );
    vi.mocked(fetchOrder).mockImplementation(async (id) =>
      id === 'a' ? { ...creatingOrder('a'), status: 'ORDERED' } : creatingOrder('b'),
    );
    const { user, onBatchChange } = setup();
    await user.click(screen.getByRole('button', { name: 'orders.edit.delete-batch' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'orders.edit.delete-batch',
      }),
    );
    await waitFor(() => expect(screen.getByText('orders.edit.not-creating')).toBeVisible());
    expect(onBatchChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: /Facility b/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'orders.edit.create' })).toBeDisabled();
  });
  it('explains refused order reads in place', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <OrderEditor
          entries={[{ id: 'a', problem: 'no-read-access' }]}
          onTab={vi.fn()}
          onBatchChange={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText('orders.edit.no-read-access')).toBeVisible();
    expect(screen.getByRole('button', { name: 'orders.edit.remove-from-batch' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'orders.edit.create' })).toBeDisabled();
  });
});

it.each(['delete', 'remove'] as const)(
  'preserves surviving edits through route navigation after %s',
  async (action) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
    vi.mocked(fetchOrder).mockImplementation(async (id) => {
      if (id === 'a' && action === 'remove')
        throw new AxiosError('Denied', undefined, undefined, undefined, { status: 403 } as never);
      return creatingOrder(id);
    });
    vi.mocked(deleteOrders).mockResolvedValue(undefined);
    const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
    const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
    const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
    const pending = vi.fn(() => <p>Pending Orders</p>);
    const page = createRoute({
      getParentRoute: () => layout,
      path: 'requisitions/create-orders/$orderIds',
      validateSearch: Route.options.validateSearch as never,
      loader: Route.options.loader as never,
      component: Route.options.component as never,
      pendingComponent: pending,
    });
    const router = createRouter({
      routeTree: root.addChildren([
        group.addChildren([layout.addChildren([page] as never)] as never),
      ] as never),
      history: createMemoryHistory({ initialEntries: ['/requisitions/create-orders/a,b?tab=b'] }),
      context: { queryClient: client },
    } as never) as AnyRouter;
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await screen.findByRole('textbox', { name: /orders.edit.quantity Medicine/ });
    fireEvent.change(quantity(), { target: { value: '25' } });
    const pendingBefore = pending.mock.calls.length;
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /^(Facility a|a)/ }));
    if (action === 'remove')
      await user.click(screen.getByRole('button', { name: 'orders.edit.remove-from-batch' }));
    else {
      await user.click(screen.getByRole('button', { name: 'orders.edit.delete-order' }));
      await user.click(
        within(screen.getByRole('alertdialog')).getByRole('button', {
          name: 'orders.edit.delete-order-action',
        }),
      );
    }
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/requisitions/create-orders/b'),
    );
    expect(quantity()).toHaveValue('25');
    expect(screen.getByRole('tab', { name: /Facility b/ })).toHaveTextContent(
      'orders.edit.unsaved',
    );
    expect(pending).toHaveBeenCalledTimes(pendingBefore);
    expect(fetchOrder).toHaveBeenCalledTimes(2);
  },
);
