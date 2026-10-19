import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ErrorFallback } from '@/components/error-fallback';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchMinimalFacilities, fetchPrograms } from '@/features/reference-data/api/api';
import { fetchSupplyLine, fetchSupplyLinesPage } from '@/features/supply-lines/api/api';
import type { SupplyLinesSearch } from '@/features/supply-lines/lib/search';
import { Route as ListRoute } from '@/routes/(protected)/_protected.administration.supply-lines';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/supply-lines/api/api', () => ({
  fetchSupplyLine: vi.fn(),
  fetchSupplyLinesPage: vi.fn(),
  fetchServedFacilities: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchMinimalFacilities: vi.fn(),
  fetchPrograms: vi.fn(),
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
const detailPath = `${listPath}?${query}&supplyLine=${id}`;
const line = {
  id,
  program: { name: 'Essential Meds' },
  supervisoryNode: { code: 'NODE-CODE' },
  supplyingFacility: { name: 'Supplier Clinic' },
  description: 'First line\nSecond line',
};

function renderRoute(path = `${listPath}?${query}`) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    errorComponent: ErrorFallback,
  });
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
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([list] as never)] as never),
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

it.each(['cancel', 'escape'])(
  'closes through %s after real row View and supports Back/Forward without changing the table',
  async (way) => {
    const user = userEvent.setup();
    const router = renderRoute();
    const view = await screen.findByRole('button', { name: 'supply-lines.view' });
    expect(view.getAttribute('href')).toContain(`supplyLine=${id}`);
    await user.click(view);
    const dialog = await screen.findByRole('dialog');
    expect((await within(dialog).findByText('First line Second line')).textContent).toBe(
      line.description,
    );
    expect(router.state.location.search).toEqual({ ...search, supplyLine: id });
    expect(fetchSupplyLinesPage).toHaveBeenCalledTimes(1);
    if (way === 'cancel')
      await user.click(within(dialog).getByRole('button', { name: 'supply-lines.view.cancel' }));
    else await user.keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.search).toEqual(search));
    expect(router.state.location.pathname).toBe(listPath);
    expect(await screen.findByRole('button', { name: 'supply-lines.view' })).toBe(view);
    act(() => router.history.forward());
    await screen.findByRole('dialog');
    await waitFor(() => expect(router.state.location.search.supplyLine).toBe(id));
    act(() => router.history.back());
    await waitFor(() => expect(router.state.location.search).toEqual(search));
    expect(fetchSupplyLinesPage).toHaveBeenCalledTimes(1);
  },
);

it('closes a shared or reloaded dialog URL on the list by replacing its search', async () => {
  const router = renderRoute(detailPath);
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByText('First line Second line');
  await userEvent.click(within(dialog).getByRole('button', { name: 'supply-lines.view.cancel' }));
  await waitFor(() => expect(router.state.location.search).toEqual(search));
  expect(router.state.location.pathname).toBe(listPath);
  expect(router.history.length).toBe(1);
});

it('keeps Cancel usable while the detail is pending', async () => {
  vi.mocked(fetchSupplyLine).mockReturnValue(new Promise(() => {}));
  const router = renderRoute(detailPath);
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'supply-lines.view.cancel' }));
  await waitFor(() => expect(router.state.location.search).toEqual(search));
  expect(router.state.location.pathname).toBe(listPath);
});

it.each(['malformed', 'missing', 'failed', 'refused'])(
  'handles a %s detail in the dialog and retains the list search',
  async (kind) => {
    if (kind !== 'malformed')
      vi.mocked(fetchSupplyLine).mockRejectedValue(
        httpError(kind === 'missing' ? 404 : kind === 'refused' ? 403 : 500),
      );
    const router = renderRoute(
      kind === 'malformed' ? `${listPath}?${query}&supplyLine=bad-id` : detailPath,
    );
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText(
      kind === 'failed'
        ? 'supply-lines.view.error-title'
        : kind === 'refused'
          ? 'no-access.description'
          : 'supply-lines.view.not-found-description',
    );
    if (kind === 'malformed') expect(fetchSupplyLine).not.toHaveBeenCalled();
    if (kind === 'failed') {
      vi.mocked(fetchSupplyLine).mockResolvedValue(line);
      await userEvent.click(within(dialog).getByRole('button', { name: 'error.try-again' }));
      await within(dialog).findByText('First line Second line');
    }
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.search).toEqual(search));
    expect(router.state.location.pathname).toBe(listPath);
  },
);

it('resolves the right before any feature GET, including a directly linked dialog', async () => {
  let resolve!: (rights: string[]) => void;
  vi.mocked(fetchPermissionStrings).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  renderRoute(detailPath);
  await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalled());
  expect(fetchSupplyLine).not.toHaveBeenCalled();
  expect(fetchSupplyLinesPage).not.toHaveBeenCalled();
  await act(async () => resolve([]));
  await screen.findByRole('heading', { name: 'no-access.title' });
  expect(fetchSupplyLine).not.toHaveBeenCalled();
  expect(fetchSupplyLinesPage).not.toHaveBeenCalled();
});

it('replaces pending lookup controls and keeps the program usable through a facility error and retry', async () => {
  let rejectFacilities!: (error: Error) => void;
  let resolvePrograms!: (programs: never[]) => void;
  vi.mocked(fetchMinimalFacilities).mockReturnValue(
    new Promise((_, reject) => {
      rejectFacilities = reject;
    }),
  );
  vi.mocked(fetchPrograms).mockReturnValue(
    new Promise((resolve) => {
      resolvePrograms = resolve;
    }),
  );
  renderRoute();
  await screen.findByRole('button', { name: 'supply-lines.view' });
  await userEvent.click(screen.getByRole('button', { name: /Filters/ }));
  const filters = await screen.findByRole('dialog', { name: 'Filters' });
  expect(
    within(filters).getByRole('status', { name: 'supply-lines.facilities-loading' }),
  ).toHaveAttribute('aria-busy', 'true');
  expect(
    within(filters).getByRole('status', { name: 'supply-lines.programs-loading' }),
  ).toHaveAttribute('aria-busy', 'true');
  expect(within(filters).queryByRole('combobox')).toBeNull();
  await act(async () => {
    resolvePrograms([{ id, code: 'MED', name: 'Essential Meds' }] as never);
    rejectFacilities(httpError(500));
  });
  expect(
    await within(filters).findByRole('combobox', { name: 'supply-lines.program' }),
  ).toBeEnabled();
  await within(filters).findByText('supply-lines.facilities-error');
  vi.mocked(fetchMinimalFacilities).mockResolvedValue([
    { id, name: 'Supplier Clinic', code: 'SUP' },
  ] as never);
  await userEvent.click(within(filters).getByRole('button', { name: 'Try Again' }));
  await waitFor(() =>
    expect(within(filters).queryByText('supply-lines.facilities-error')).toBeNull(),
  );
  expect(fetchMinimalFacilities).toHaveBeenCalledTimes(2);
  expect(
    await within(filters).findByRole('combobox', { name: 'supply-lines.supplying-facility' }),
  ).toBeEnabled();
});
