import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireRight } from '@/features/auth/lib/access';
import { fetchApprovals, fetchProduct } from '@/features/products/api/api';
import { productDetailOptions } from '@/features/products/api/queries';
import type { ProductsSearch } from '@/features/products/lib/search';
import type { Approval, ProductDetail } from '@/features/products/lib/types';
import {
  fetchFacilityTypes,
  fetchOrderablesByIds,
  fetchPrograms,
} from '@/features/reference-data/api/api';
import { Route } from '@/routes/(protected)/_protected.administration.products_.$id';
import { Route as FacilityTypesRoute } from '@/routes/(protected)/_protected.administration.products_.$id.facility-types';
import { Route as GeneralRoute } from '@/routes/(protected)/_protected.administration.products_.$id.general';
import { Route as KitRoute } from '@/routes/(protected)/_protected.administration.products_.$id.kit-unpack-list';

vi.mock('@/features/auth/lib/access', () => ({
  requireRight: vi.fn(async () => new Set(['ORDERABLES_MANAGE'])),
}));
vi.mock('@/features/products/api/api', () => ({
  fetchApprovals: vi.fn(),
  fetchProduct: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchFacilityTypes: vi.fn(),
  fetchOrderablesByIds: vi.fn(),
  fetchPrograms: vi.fn(),
}));

const fetchMock = vi.mocked(fetchProduct);

const version = (fullProductName: string) =>
  ({ id: 'o1', productCode: 'C100', fullProductName }) as ProductDetail;

function productRouter(queryClient: QueryClient) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const product = createRoute({
    getParentRoute: () => root,
    path: '/products/$id',
    loader: Route.options.loader as never,
    preload: Route.options.preload,
  });
  const list = createRoute({ getParentRoute: () => root, path: '/' });
  const options = {
    routeTree: root.addChildren([list, product] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ['/'] }),
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  };
  return createRouter(options as never) as AnyRouter;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('product edit loader', () => {
  it('opens on a fresh read even after a hover preloaded the page', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(productDetailOptions('o1').queryKey, version('Old'));
    fetchMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(version('New')), 20)),
    );
    const router = productRouter(queryClient);
    await router.load();

    await router.preloadRoute({ to: '/products/$id', params: { id: 'o1' } } as never);
    await router.navigate({ to: '/products/$id', params: { id: 'o1' } } as never);

    expect(queryClient.getQueryData(productDetailOptions('o1').queryKey)).toEqual(version('New'));
  });
});

const kit: ProductDetail = {
  id: 'o1',
  productCode: 'C100',
  fullProductName: 'Delivery Kit',
  description: null,
  netContent: 1,
  packRoundingThreshold: 0,
  roundToZero: false,
  dispensable: { dispensingUnit: 'kit' },
  programs: [{ programId: 'fp' }],
  children: [{ orderable: { id: 'g1' }, quantity: 2 }],
};

const approval: Approval = {
  id: 'a1',
  maxPeriodsOfStock: 3,
  minPeriodsOfStock: null,
  emergencyOrderPoint: null,
  active: true,
  orderable: { id: 'o1' },
  facilityType: { id: 'hc', code: 'health_center', name: 'Health Center' },
  program: { id: 'fp', code: 'PRG001', name: 'Family Planning' },
};

const listSearch: ProductsSearch = { name: 'kit', page: 2 };

const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({ component: Outlet });
const shell = createRoute({
  getParentRoute: () => root,
  id: '/(protected)/_protected',
  component: Outlet,
});
const productsList = createRoute({
  getParentRoute: () => shell,
  path: '/administration/products',
  component: () => <p>products list</p>,
});
Route.update({
  id: '/administration/products_/$id',
  path: '/administration/products/$id',
  getParentRoute: () => shell,
} as never);
for (const [tab, path] of [
  [GeneralRoute, '/general'],
  [FacilityTypesRoute, '/facility-types'],
  [KitRoute, '/kit-unpack-list'],
] as const) {
  tab.update({ id: path, path, getParentRoute: () => Route } as never);
}
const editTree = root.addChildren([
  shell.addChildren([
    productsList,
    Route.addChildren([GeneralRoute, FacilityTypesRoute, KitRoute] as never),
  ] as never),
] as never);

async function openTab(tab: 'general' | 'facility-types' | 'kit-unpack-list') {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree: editTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ['/administration/products'] }),
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByText('products list');
  await act(() =>
    router.navigate({
      to: `/administration/products/o1/${tab}`,
      state: { productsListSearch: listSearch },
    } as never),
  );
  return router;
}

async function expectBackOnList(router: AnyRouter) {
  expect(await screen.findByText('products list')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/administration/products');
  expect(router.state.location.search).toEqual(listSearch);
}

describe('product edit page', () => {
  beforeEach(() => {
    vi.mocked(requireRight).mockResolvedValue(new Set(['ORDERABLES_MANAGE']));
    fetchMock.mockResolvedValue(kit);
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([
      {
        id: 'g1',
        productCode: 'G1',
        fullProductName: 'Gloves',
        description: null,
        dispensable: { displayUnit: 'each' },
      },
    ]);
    vi.mocked(fetchApprovals).mockResolvedValue([approval]);
    vi.mocked(fetchFacilityTypes).mockResolvedValue([]);
    vi.mocked(fetchPrograms).mockResolvedValue([]);
  });

  it('returns to the products list with its search on Cancel from General', async () => {
    const router = await openTab('general');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.edit.cancel' }));

    await expectBackOnList(router);
  });

  it('returns to the list at once on Cancel from an unchanged kit', async () => {
    const router = await openTab('kit-unpack-list');
    const user = userEvent.setup();

    await screen.findByRole('textbox', { name: 'products.kit.quantity-of' });
    await user.click(screen.getByRole('button', { name: 'products.edit.cancel' }));

    await expectBackOnList(router);
  });

  it('asks before discarding kit changes on Cancel, and leaves once discarded', async () => {
    const router = await openTab('kit-unpack-list');
    const user = userEvent.setup();

    const quantity = await screen.findByRole('textbox', { name: 'products.kit.quantity-of' });
    await user.type(quantity, '5');
    await user.click(screen.getByRole('button', { name: 'products.edit.cancel' }));

    expect(
      await screen.findByRole('alertdialog', { name: 'discard-changes.title' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/administration/products/o1/kit-unpack-list');
    await user.click(screen.getByRole('button', { name: 'discard-changes.discard' }));

    await expectBackOnList(router);
  });

  it('offers only View on facility types to a user who may not manage approvals', async () => {
    await openTab('facility-types');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.approvals.actions-for' }));

    expect(
      await screen.findByRole('menuitem', { name: 'products.approvals.view' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'products.approvals.edit' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'products.approvals.remove' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'products.approvals.add' }),
    ).not.toBeInTheDocument();
  });

  it('offers Add, Edit and Remove on facility types to a user who manages approvals', async () => {
    vi.mocked(requireRight).mockResolvedValue(new Set(['FACILITY_APPROVED_ORDERABLES_MANAGE']));
    await openTab('facility-types');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'products.approvals.actions-for' }));

    expect(
      await screen.findByRole('menuitem', { name: 'products.approvals.edit' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'products.approvals.remove' })).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'products.approvals.view' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'products.approvals.add' })).toBeInTheDocument();
  });
});
