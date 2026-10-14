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
import { RIGHTS } from '@/features/auth/lib/rights';
import { fetchSupervisoryNode } from '@/features/supervisory-nodes/api/api';
import { supervisoryNodeOptions } from '@/features/supervisory-nodes/api/queries';
import type { SupervisoryNode } from '@/features/supervisory-nodes/lib/types';
import { Route } from '@/routes/(protected)/_protected.administration.supervisory-nodes_.$id';

vi.mock('@/features/auth/lib/access', () => ({
  requireRight: vi.fn(async () => new Set(['SUPERVISORY_NODES_MANAGE'])),
}));
vi.mock('@/features/supervisory-nodes/api/api', () => ({
  fetchSupervisoryNode: vi.fn(),
  fetchSupervisoryNodesByIds: vi.fn(async () => []),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchSupervisoryNodes: vi.fn(async () => []),
  fetchMinimalFacilities: vi.fn(async () => []),
}));

const version = (name: string) =>
  ({ id: 'f1', code: 'HC01', name, childNodes: [], partnerNodes: [] }) as SupervisoryNode;

function editRouter(queryClient: QueryClient) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const edit = createRoute({
    getParentRoute: () => root,
    path: '/supervisory-nodes/$id',
    loader: Route.options.loader as never,
    preload: Route.options.preload,
  });
  const list = createRoute({ getParentRoute: () => root, path: '/' });
  const options = {
    routeTree: root.addChildren([list, edit] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ['/'] }),
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  };
  return createRouter(options as never) as AnyRouter;
}

const later = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 20));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('supervisory node edit loader', () => {
  it('opens on a fresh read even after a hover preloaded the page', async () => {
    const queryClient = new QueryClient();
    const server = { node: version('At Hover') };
    vi.mocked(fetchSupervisoryNode).mockImplementation(() => later(server.node));
    const router = editRouter(queryClient);
    await router.load();

    await router.preloadRoute({ to: '/supervisory-nodes/$id', params: { id: 'f1' } } as never);
    server.node = version('New');
    await router.navigate({ to: '/supervisory-nodes/$id', params: { id: 'f1' } } as never);

    expect(requireRight).toHaveBeenCalledWith(queryClient, RIGHTS.supervisoryNodesManage);
    expect(queryClient.getQueryData(supervisoryNodeOptions('f1').queryKey)).toEqual(version('New'));
  });
});
