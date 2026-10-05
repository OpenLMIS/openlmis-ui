import { QueryClient } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFacility } from '@/features/reference-data/api/api';
import { facilityOptions } from '@/features/reference-data/api/queries';
import type { Facility } from '@/features/reference-data/lib/types';
import { Route } from '@/routes/(protected)/_protected.administration.facilities_.$id';

vi.mock('@/features/auth/lib/access', () => ({
  requireRight: vi.fn(async () => new Set(['FACILITIES_MANAGE'])),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchFacility: vi.fn(),
  fetchFacilityTypes: vi.fn(async () => []),
  fetchGeographicZones: vi.fn(async () => []),
  fetchFacilityOperators: vi.fn(async () => []),
  fetchPrograms: vi.fn(async () => []),
}));

const version = (name: string) => ({ id: 'f1', code: 'HC01', name }) as Facility;

function editRouter(queryClient: QueryClient) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const edit = createRoute({
    getParentRoute: () => root,
    path: '/facilities/$id',
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

describe('facility edit loader', () => {
  it('opens on a fresh read even after a hover preloaded the page', async () => {
    const queryClient = new QueryClient();
    const server = { facility: version('At Hover') };
    vi.mocked(fetchFacility).mockImplementation(() => later(server.facility));
    const router = editRouter(queryClient);
    await router.load();

    await router.preloadRoute({ to: '/facilities/$id', params: { id: 'f1' } } as never);
    server.facility = version('New');
    await router.navigate({ to: '/facilities/$id', params: { id: 'f1' } } as never);

    expect(queryClient.getQueryData(facilityOptions('f1').queryKey)).toEqual(version('New'));
  });
});
