import { QueryClient } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireRight } from '@/features/auth/lib/access';
import { fetchRequisitionGroup } from '@/features/requisition-groups/api/api';
import { requisitionGroupOptions } from '@/features/requisition-groups/api/queries';
import { Route as ListRoute } from '@/routes/(protected)/_protected.administration.requisition-groups';
import { Route as EditRoute } from '@/routes/(protected)/_protected.administration.requisition-groups_.$id_.edit';
import { Route as AddRoute } from '@/routes/(protected)/_protected.administration.requisition-groups_.new';

vi.mock('@/features/auth/lib/access', () => ({
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
function editRouter(queryClient: QueryClient) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const edit = createRoute({
    getParentRoute: () => root,
    path: '/groups/$id/edit',
    loader: EditRoute.options.loader as never,
    preload: EditRoute.options.preload,
    validateSearch: EditRoute.options.validateSearch,
  });
  const list = createRoute({ getParentRoute: () => root, path: '/' });
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
  it('reads fresh after hover, then preserves the cached detail on a tab change', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(requisitionGroupOptions('rg').queryKey, version('Old'));
    let server = version('At Hover');
    vi.mocked(fetchRequisitionGroup).mockImplementation(async () => server);
    const router = editRouter(queryClient);
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
  });
  it('checks the manage right on list, add and edit', async () => {
    vi.mocked(fetchRequisitionGroup).mockResolvedValue(version('Group'));
    const queryClient = new QueryClient();
    for (const route of [ListRoute, AddRoute, EditRoute]) {
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
