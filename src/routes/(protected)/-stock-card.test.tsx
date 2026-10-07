import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchStockCard } from '@/features/stock-card/api/api';
import type { StockCard } from '@/features/stock-card/lib/types';
import { Route } from '@/routes/(protected)/_protected.stock-management.stock-on-hand_.$stockCardId';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/stock-card/api/api', () => ({ fetchStockCard: vi.fn() }));
vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));

const USER = 'user1';
const HOME = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const FP = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';
const EM = '10845cb9-d365-4aaa-badd-b4fa39c6a26a';
const card: StockCard = {
  id: 'card1',
  facility: { id: HOME, name: 'Comfort Health Clinic', code: 'HC01' },
  program: { id: FP, name: 'Family Planning', code: 'PRG001' },
  orderable: {
    id: 'o1',
    productCode: 'C1',
    fullProductName: 'Vaccine',
    netContent: 5,
    dispensable: { displayUnit: 'each' },
  },
  lot: { id: 'l1', lotCode: 'LOT-A', expirationDate: '2027-01-31' },
  stockOnHand: 23,
  active: false,
  lineItems: [{ id: 'line1', occurredDate: '2026-01-01', quantity: 23, stockOnHand: 23 }],
};
const grants = [`STOCK_CARDS_VIEW|${HOME}|${FP}`];
const appQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  });
const path = (extra = '') => `/stock-management/stock-on-hand/card1${extra}`;

function renderRoute(location = path(), queryClient = appQueryClient()) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const page = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/stock-on-hand/$stockCardId',
    validateSearch: Route.options.validateSearch as never,
    loader: Route.options.loader as never,
    component: Route.options.component as never,
    errorComponent: Route.options.errorComponent as never,
    pendingComponent: Route.options.pendingComponent as never,
    staticData: Route.options.staticData,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([page] as never)] as never),
    ] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [location] }),
  } as never) as AnyRouter;
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient, unmount: view.unmount };
}

beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: USER });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(grants);
  vi.mocked(fetchStockCard).mockResolvedValue(card);
});
afterEach(() => {
  useLoginData.setState({ referenceDataUserId: null });
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('stock card route', () => {
  it('opens an inactive card when the exact facility and program grant exists', async () => {
    renderRoute();
    expect(await screen.findByRole('heading', { name: 'stock-card.title' })).toBeInTheDocument();
    expect(await screen.findByText('Vaccine - each')).toBeInTheDocument();
    expect(fetchStockCard).toHaveBeenCalledWith('card1');
  });

  it('checks the card pair rather than the facility and program in the return search', async () => {
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, program: { ...card.program, id: EM } });
    renderRoute(path(`?facilityId=${HOME}&programId=${FP}&mode=my`));
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(screen.queryByText('Vaccine - each')).not.toBeInTheDocument();
  });

  it.each([
    { permissions: [] },
    { permissions: ['STOCK_CARDS_VIEW'] },
    { permissions: [`STOCK_CARDS_VIEW|another-facility|${FP}`] },
  ])('refuses missing or differently scoped grants: %j', async ({ permissions }) => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue(permissions);
    renderRoute();
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(screen.queryByText('Vaccine - each')).not.toBeInTheDocument();
  });

  it.each([400, 404])('shows Not Found for status %i', async (status) => {
    vi.mocked(fetchStockCard).mockRejectedValue(httpError(status));
    renderRoute();
    expect(await screen.findByText('stock-card.not-found-title')).toBeInTheDocument();
  });

  it('shows No Access for a server refusal', async () => {
    vi.mocked(fetchStockCard).mockRejectedValue(httpError(403));
    renderRoute();
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
  });

  it('shows a load failure with retry for other server errors', async () => {
    vi.mocked(fetchStockCard).mockRejectedValue(httpError(500));
    renderRoute();
    expect(
      await screen.findByRole('heading', { name: 'stock-card.error-title' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'error.try-again' })).toBeInTheDocument();
  });

  it('does not ask for a card when the user changes while permissions load', async () => {
    let release = () => {};
    vi.mocked(fetchPermissionStrings).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(grants);
      }),
    );
    renderRoute();
    await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalled());
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    await act(async () => release());
    expect(fetchStockCard).not.toHaveBeenCalled();
  });

  it('does not reveal a late card after the user changes', async () => {
    let release = () => {};
    vi.mocked(fetchStockCard).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(card);
      }),
    );
    const { router } = renderRoute();
    await waitFor(() => expect(fetchStockCard).toHaveBeenCalled());
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    await act(async () => release());
    await waitFor(() => expect(router.state.status).toBe('idle'));
    expect(screen.queryByText('Vaccine - each')).not.toBeInTheDocument();
  });
});
