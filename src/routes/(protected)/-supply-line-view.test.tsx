import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchSupplyLine, fetchSupplyLinesPage } from '@/features/supply-lines/api/api';
import type { SupplyLinesSearch } from '@/features/supply-lines/lib/search';
import { Route as ListRoute } from '@/routes/(protected)/_protected.administration.supply-lines';
import { Route } from '@/routes/(protected)/_protected.administration.supply-lines_.$id';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/supply-lines/api/api', () => ({
  fetchSupplyLine: vi.fn(),
  fetchSupplyLinesPage: vi.fn(),
  fetchServedFacilities: vi.fn(),
}));
vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));

const id = '10845cb9-d365-4aaa-badd-b4fa39c6a26a';
const search = {
  page: 2,
  size: 20,
  sort: 'program.name',
  dir: 'desc',
  programId: id,
  supplyingFacilityId: id,
} satisfies SupplyLinesSearch;
const query = new URLSearchParams(
  Object.entries(search).map(([key, value]) => [key, String(value)]),
).toString();
const listPath = '/administration/supply-lines';
const detailPath = `${listPath}/${id}?${query}`;
const line = {
  id,
  program: { name: 'Essential Meds' },
  supervisoryNode: { code: 'NODE-CODE' },
  supplyingFacility: { name: 'Supplier Clinic' },
  description: 'First line\nSecond line',
};

function renderRoute(path = `${listPath}?${query}`, historySearch?: SupplyLinesSearch) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const list = createRoute({
    getParentRoute: () => layout,
    path: 'administration/supply-lines',
    validateSearch: ListRoute.options.validateSearch,
    loaderDeps: ListRoute.options.loaderDeps,
    loader: ListRoute.options.loader,
    component: ListRoute.options.component,
    pendingComponent: ListRoute.options.pendingComponent,
  } as never);
  const detail = createRoute({
    getParentRoute: () => layout,
    path: 'administration/supply-lines/$id',
    validateSearch: Route.options.validateSearch,
    loader: Route.options.loader,
    component: Route.options.component,
    pendingComponent: Route.options.pendingComponent,
    errorComponent: Route.options.errorComponent,
    staticData: Route.options.staticData,
  } as never);
  const history = createMemoryHistory({ initialEntries: [path] });
  if (historySearch) history.replace(path, { supplyLinesListSearch: historySearch });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([list, detail] as never)] as never),
    ] as never),
    context: { queryClient },
    history,
    defaultPendingMs: 0,
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    { onCaughtError: () => {} },
  );
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: 'user' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['SUPPLY_LINES_MANAGE']);
  vi.mocked(fetchSupplyLine).mockResolvedValue(line);
  vi.mocked(fetchSupplyLinesPage).mockResolvedValue({
    content: [line],
    totalElements: 40,
    totalPages: 2,
  } as never);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  useLoginData.setState({ referenceDataUserId: null });
  vi.restoreAllMocks();
});

it.each(['cancel', 'breadcrumb'])(
  'returns through %s after the real row View action, preserving full list search',
  async (way) => {
    const user = userEvent.setup();
    const router = renderRoute();
    await user.click(await screen.findByRole('button', { name: 'supply-lines.actions-for' }));
    await user.click(await screen.findByRole('menuitem', { name: 'supply-lines.view' }));
    await screen.findByRole('heading', { name: 'supply-lines.view.title' });
    expect(router.state.location.search).toEqual(search);
    expect(router.state.location.state.supplyLinesListSearch).toEqual(search);
    expect((await screen.findByText('First line Second line')).textContent).toBe(line.description);
    await user.click(
      way === 'cancel'
        ? screen.getByRole('button', { name: 'supply-lines.view.cancel' })
        : screen.getByRole('link', { name: 'nav.administration.supply-lines' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(listPath));
    expect(router.state.location.search).toEqual(search);
  },
);

it('returns from a reloaded or directly shared detail URL without history state', async () => {
  const user = userEvent.setup();
  const router = renderRoute(detailPath);
  await screen.findByText('Supplier Clinic');
  const crumb = screen.getByRole('link', { name: 'nav.administration.supply-lines' });
  expect(
    Object.fromEntries(new URL(crumb.getAttribute('href') ?? '', 'http://localhost').searchParams),
  ).toEqual(Object.fromEntries(new URLSearchParams(query)));
  await user.click(screen.getByRole('button', { name: 'supply-lines.view.cancel' }));
  await waitFor(() => expect(router.state.location.pathname).toBe(listPath));
  expect(router.state.location.search).toEqual(search);
});

it('prefers the captured originating history search for Cancel', async () => {
  const origin = { ...search, page: 1, dir: 'asc' as const };
  const router = renderRoute(detailPath, origin);
  await screen.findByText('Supplier Clinic');
  await userEvent.click(screen.getByRole('button', { name: 'supply-lines.view.cancel' }));
  await waitFor(() => expect(router.state.location.pathname).toBe(listPath));
  expect(router.state.location.search).toEqual(origin);
});

it('keeps Cancel usable during navigation to a pending detail, using the latest URL search', async () => {
  const router = renderRoute(listPath);
  await screen.findByRole('button', { name: 'supply-lines.actions-for' });
  vi.mocked(fetchSupplyLine).mockReturnValue(new Promise(() => {}));
  act(() => {
    void router.navigate({ to: `${listPath}/$id`, params: { id }, search });
  });
  await userEvent.click(await screen.findByRole('button', { name: 'supply-lines.view.cancel' }));
  await waitFor(() => expect(router.state.location.pathname).toBe(listPath));
  expect(router.state.location.search).toEqual(search);
});

it.each(['malformed', 'missing', 'failed'])(
  'keeps the filtered return from a %s detail',
  async (kind) => {
    if (kind !== 'malformed')
      vi.mocked(fetchSupplyLine).mockRejectedValue(httpError(kind === 'missing' ? 404 : 500));
    const router = renderRoute(kind === 'malformed' ? `${listPath}/bad-id?${query}` : detailPath);
    const back = await screen.findByRole('button', { name: 'supply-lines.view.back' });
    expect(
      await screen.findByRole('heading', {
        name:
          kind === 'failed' ? 'supply-lines.view.error-title' : 'supply-lines.view.not-found-title',
      }),
    ).toBeInTheDocument();
    if (kind === 'malformed') expect(fetchSupplyLine).not.toHaveBeenCalled();
    await userEvent.click(back);
    await waitFor(() => expect(router.state.location.pathname).toBe(listPath));
    expect(router.state.location.search).toEqual(search);
  },
);

it('checks the right before validating the id or requesting the detail', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
  renderRoute(`${listPath}/bad-id?${query}`);
  expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
  expect(fetchSupplyLine).not.toHaveBeenCalled();
});
