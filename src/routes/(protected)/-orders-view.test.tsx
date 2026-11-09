import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { requirePermissions } from '@/features/auth/lib/access';
import {
  orderRequestingFacilitiesOptions,
  ordersSearchOptions,
  viewSupplierFacilitiesOptions,
} from '@/features/orders/api/queries';
import { toOrderParams } from '@/features/orders/lib/order-search';
import { deploymentTimeZoneOptions, programsOptions } from '@/features/reference-data/api/queries';
import { parsePermissions } from '@/lib/permissions';
import { Route } from '@/routes/(protected)/_protected.orders.view';
import { orderSummary } from '@/test-utils/order-fixtures';

vi.mock('@/features/auth/lib/access', async (original) => ({
  ...(await original<typeof import('@/features/auth/lib/access')>()),
  requirePermissions: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchPrograms: vi.fn(async () => {
    throw new Error('Programs unavailable');
  }),
}));
const supplier = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const requester = '33333333-3333-4333-8333-333333333333';
const permissions = parsePermissions([`ORDERS_VIEW|${supplier}`, `ORDERS_VIEW|${other}`]);
beforeEach(() => {
  vi.mocked(requirePermissions).mockResolvedValue(permissions);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1440,
  } as DOMRect);
});
function setup(failedPrograms = false, page?: number) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(viewSupplierFacilitiesOptions(permissions).queryKey, [
    { id: supplier, code: 'A', name: 'First Supplier', active: true },
    { id: other, code: 'B', name: 'Second Supplier', active: true },
  ]);
  client.setQueryData(orderRequestingFacilitiesOptions([supplier]).queryKey, []);
  client.setQueryData(orderRequestingFacilitiesOptions([other]).queryKey, []);
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  const programs = programsOptions();
  if (failedPrograms)
    client
      .getQueryCache()
      .build(client, { queryKey: programs.queryKey })
      .setState({ status: 'error', error: new Error('Programs unavailable') });
  else client.setQueryData(programs.queryKey, []);
  const search = { supplyingFacilityId: supplier, requestingFacilityId: requester, page };
  const result = {
    content: [orderSummary('a')],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 10,
  };
  client.setQueryData(ordersSearchOptions(toOrderParams(search)).queryKey, result);
  client.setQueryData(
    ordersSearchOptions(toOrderParams({ ...search, page: undefined })).queryKey,
    result,
  );
  client.setQueryData(ordersSearchOptions(toOrderParams({ supplyingFacilityId: other })).queryKey, {
    ...result,
    content: [orderSummary('b')],
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const pageRoute = createRoute({
    getParentRoute: () => layout,
    path: 'orders/view',
    validateSearch: Route.options.validateSearch as never,
    loaderDeps: Route.options.loaderDeps as never,
    loader: Route.options.loader as never,
    component: Route.options.component as never,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([pageRoute] as never)] as never),
    ] as never),
    context: { queryClient: client },
    history: createMemoryHistory({
      initialEntries: [
        `/orders/view?supplyingFacilityId=${supplier}&requestingFacilityId=${requester}${page ? `&page=${page}` : ''}`,
      ],
    }),
  } as never) as AnyRouter;
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, invalidate };
}
it.each(['clear', 'change'])(
  'hides the toolbar and results after supplier %s and drops the old requester on Search',
  async (action) => {
    const user = userEvent.setup();
    const { router } = setup();
    await screen.findByText('ORDER-A');
    expect(screen.getByRole('button', { name: 'View' })).toBeVisible();
    if (action === 'clear')
      await user.click(screen.getByRole('button', { name: 'orders.view.clear-supplier' }));
    else {
      await user.click(screen.getByRole('combobox', { name: /orders.view.supplier/ }));
      await user.click(await screen.findByRole('option', { name: /Second Supplier/ }));
    }
    expect(screen.queryByText('ORDER-A')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
    if (action === 'change') {
      await user.click(screen.getByRole('button', { name: 'facility-program.search' }));
      await waitFor(() =>
        expect(router.state.location.search).toMatchObject({ supplyingFacilityId: other }),
      );
      expect(router.state.location.search).not.toHaveProperty('requestingFacilityId');
      expect(await screen.findByText('ORDER-B')).toBeVisible();
    }
  },
);
it('keeps the picker and toolbar visible when programs fail', async () => {
  setup(true);
  expect(await screen.findByText('orders.view.error-title')).toBeVisible();
  expect(screen.getByRole('combobox', { name: /orders.view.supplier/ })).toBeVisible();
  expect(screen.getByRole('button', { name: 'View' })).toBeVisible();
});
it('returns the same supplier to page one without invalidating the old page', async () => {
  const { router, invalidate } = setup(false, 2);
  const user = userEvent.setup();
  await screen.findByText('ORDER-A');
  await user.click(screen.getByRole('button', { name: 'facility-program.search' }));
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('page'));
  expect(invalidate).not.toHaveBeenCalled();
});
