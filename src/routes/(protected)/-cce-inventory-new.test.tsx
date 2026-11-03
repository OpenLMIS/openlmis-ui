import { QueryClient } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { Route } from '@/routes/(protected)/_protected.cce.inventory_.new';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchUserRecord: vi.fn(async () => ({ id: 'u1', homeFacilityId: 'home' })),
  fetchUserPrograms: vi.fn(async () => []),
  fetchMinimalFacilities: vi.fn(async () => []),
}));
vi.mock('@/features/cce-inventory/api/api', () => ({ fetchCatalogItems: vi.fn(async () => []) }));

const routeMatchWarning = /^Warning: Error in route match/;

function loadAddEquipment() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const page = createRoute({
    getParentRoute: () => root,
    path: '/cce/inventory/new',
    loader: Route.options.loader as never,
  });
  const router = createRouter({
    routeTree: root.addChildren([page] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ['/cce/inventory/new'] }),
  } as never) as AnyRouter;
  return router.load().then(() => router.state.matches.at(-1)?.error);
}

beforeEach(() => {
  useLoginData.setState({ referenceDataUserId: 'u1' });
  const forward = console.warn.bind(console);
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] !== 'string' || !routeMatchWarning.test(args[0])) forward(...args);
  });
});

afterEach(() => {
  useLoginData.setState({ referenceDataUserId: null });
});

it.each([
  ['edit without view', ['CCE_INVENTORY_EDIT|home|epi']],
  ['view without edit', ['CCE_INVENTORY_VIEW|home|epi']],
  [
    'edit one pair and view another',
    ['CCE_INVENTORY_EDIT|home|epi', 'CCE_INVENTORY_VIEW|lurio|fp'],
  ],
])('keeps Add Equipment closed to a user who can %s the inventory', async (_name, grants) => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue(grants);

  expect(await loadAddEquipment()).toBeInstanceOf(ForbiddenError);
});

it('opens Add Equipment to a user who can view and edit the inventory', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    'CCE_INVENTORY_VIEW|home|epi',
    'CCE_INVENTORY_EDIT|home|epi',
  ]);

  expect(await loadAddEquipment()).toBeUndefined();
});
