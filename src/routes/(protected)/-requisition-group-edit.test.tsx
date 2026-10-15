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
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireRight } from '@/features/auth/lib/access';
import { fetchRequisitionGroup } from '@/features/requisition-groups/api/api';
import { requisitionGroupOptions } from '@/features/requisition-groups/api/queries';
import { Route as ListRoute } from '@/routes/(protected)/_protected.administration.requisition-groups';
import { Route as ViewRoute } from '@/routes/(protected)/_protected.administration.requisition-groups_.$id';
import { Route as EditRoute } from '@/routes/(protected)/_protected.administration.requisition-groups_.$id_.edit';
import { Route as AddRoute } from '@/routes/(protected)/_protected.administration.requisition-groups_.new';

vi.mock('@/components/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));
vi.mock('@/features/auth/lib/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/lib/access')>()),
  requireRight: vi.fn(async () => new Set(['REQUISITION_GROUPS_MANAGE'])),
}));
vi.mock('@/features/requisition-groups/api/api', () => ({
  fetchRequisitionGroup: vi.fn(),
  searchRequisitionGroups: vi.fn(async () => ({ content: [], totalElements: 0, totalPages: 0 })),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchSupervisoryNodes: vi.fn(async () => []),
  fetchPrograms: vi.fn(async () => []),
  fetchProcessingSchedules: vi.fn(async () => []),
  fetchMinimalFacilities: vi.fn(async () => []),
  fetchGeographicZones: vi.fn(async () => []),
}));
const version = (name: string) => ({
  id: 'rg',
  name,
  code: 'RG',
  supervisoryNode: { id: 'n1', name: 'Node' },
  requisitionGroupProgramSchedules: [],
  memberFacilities: [],
});
function editRouter(queryClient: QueryClient, route: typeof EditRoute | typeof ViewRoute) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const edit = route.update({
    getParentRoute: () => root,
    id:
      route === EditRoute
        ? '/(protected)/_protected/administration/requisition-groups_/$id_/edit'
        : '/(protected)/_protected/administration/requisition-groups_/$id',
    path: '/groups/$id/edit',
  } as never);
  const list = createRoute({ getParentRoute: () => root, path: '/', component: () => <p>List</p> });
  return createRouter({
    routeTree: root.addChildren([list, edit] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ['/'] }),
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  } as never) as AnyRouter;
}
beforeEach(() => vi.clearAllMocks());
describe('requisition group edit loader', () => {
  it.each([EditRoute, ViewRoute])(
    'reads fresh after hover, then preserves the cached detail on a tab change (%#)',
    async (route) => {
      const queryClient = new QueryClient();
      queryClient.setQueryData(requisitionGroupOptions('rg').queryKey, version('Old'));
      let server = version('At Hover');
      vi.mocked(fetchRequisitionGroup).mockImplementation(async () => server);
      const router = editRouter(queryClient, route);
      await router.load();
      await router.preloadRoute({ to: '/groups/$id/edit', params: { id: 'rg' } } as never);
      server = version('New');
      await router.navigate({ to: '/groups/$id/edit', params: { id: 'rg' } } as never);
      expect(queryClient.getQueryData(requisitionGroupOptions('rg').queryKey)).toEqual(
        version('New'),
      );
      vi.mocked(fetchRequisitionGroup).mockClear();
      await router.navigate({
        to: '/groups/$id/edit',
        params: { id: 'rg' },
        search: { tab: 'facilities' },
      } as never);
      expect(fetchRequisitionGroup).not.toHaveBeenCalled();
      render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );
      const label =
        route === EditRoute ? 'requisition-groups.form.name' : 'requisition-groups.form.view-name';
      expect(await screen.findByRole('textbox', { name: label })).toHaveValue('New');
      await act(async () => {
        await router.navigate({ to: '/' } as never);
      });
      await screen.findByText('List');
      let resolveRead!: (value: ReturnType<typeof version>) => void;
      vi.mocked(fetchRequisitionGroup).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRead = resolve;
          }),
      );
      let navigation!: Promise<void>;
      act(() => {
        navigation = router.navigate({ to: '/groups/$id/edit', params: { id: 'rg' } } as never);
      });
      await waitFor(() => expect(fetchRequisitionGroup).toHaveBeenCalled());
      await act(async () => {
        resolveRead(version('Newer'));
        await navigation;
      });
      await waitFor(() =>
        expect(screen.getByRole('textbox', { name: label })).toHaveValue('Newer'),
      );
    },
  );
  it('checks the manage right on list, add, edit and view', async () => {
    vi.mocked(fetchRequisitionGroup).mockResolvedValue(version('Group'));
    const queryClient = new QueryClient();
    for (const route of [ListRoute, AddRoute, EditRoute, ViewRoute]) {
      vi.mocked(requireRight).mockClear();
      await (route.options.loader as (args: unknown) => Promise<unknown>)({
        context: { queryClient },
        params: { id: 'rg' },
        cause: 'enter',
        deps: { query: { page: 0, size: 10 } },
      });
      expect(requireRight).toHaveBeenCalledWith(queryClient, 'REQUISITION_GROUPS_MANAGE');
    }
  });
});

describe('requisition group error navigation', () => {
  it.each([
    ['edit not found', EditRoute, 404],
    ['view load error', ViewRoute, 500],
  ] as const)('preserves the list search on %s', async (_name, route, status) => {
    const ErrorPage = route.options.errorComponent;
    if (!ErrorPage) throw new Error('Missing error page');
    await ErrorPage.preload?.();
    const error = new AxiosError('Load failed', String(status), undefined, undefined, {
      status,
      statusText: 'Load failed',
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
      component: () => <ErrorPage error={error} reset={vi.fn()} />,
    });
    const history = createMemoryHistory({ initialEntries: ['/'] });
    history.replace('/', {
      requisitionGroupsListSearch: { page: 3, size: 20, name: 'Family' },
    });
    const queryClient = new QueryClient();
    const router = createRouter({ routeTree: root, context: { queryClient }, history });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    const link = await screen.findByRole('button', { name: 'requisition-groups.form.back' });
    const url = new URL(link.getAttribute('href') ?? '', 'http://localhost');
    expect(url.pathname).toBe('/administration/requisition-groups');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '3',
      size: '20',
      name: 'Family',
    });
  });
});
