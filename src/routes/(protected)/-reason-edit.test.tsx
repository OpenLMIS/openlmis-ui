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
import { fetchReason, fetchValidReasons } from '@/features/reasons/api/api';
import { reasonDetailOptions, validReasonsOptions } from '@/features/reasons/api/queries';
import type { Reason } from '@/features/reference-data/lib/types';
import { Route as ListRoute } from '@/routes/(protected)/_protected.administration.reasons';
import { Route as EditRoute } from '@/routes/(protected)/_protected.administration.reasons_.$id';
import { Route as AddRoute } from '@/routes/(protected)/_protected.administration.reasons_.new';

vi.mock('@/features/auth/lib/access', () => ({
  requireRight: vi.fn(async () => new Set(['STOCK_CARD_LINE_ITEM_REASONS_MANAGE'])),
}));
vi.mock('@/features/reasons/api/api', () => ({
  fetchReason: vi.fn(),
  fetchValidReasons: vi.fn(),
  fetchReasonTypes: vi.fn(async () => []),
  fetchReasonCategories: vi.fn(async () => []),
  fetchReasonTags: vi.fn(async () => []),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchReasons: vi.fn(async () => []),
  fetchPrograms: vi.fn(async () => []),
  fetchFacilityTypes: vi.fn(async () => []),
}));

const version = (name: string): Reason => ({
  id: 'r1',
  name,
  reasonType: 'DEBIT',
  reasonCategory: 'ADJUSTMENT',
  isFreeTextAllowed: false,
  tags: [],
});

const pair = (hidden: boolean) => ({
  id: 'v1',
  program: { id: 'p1' },
  facilityType: { id: 't1' },
  hidden,
  reason: { id: 'r1' },
});

function editRouter(queryClient: QueryClient) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const edit = createRoute({
    getParentRoute: () => root,
    path: '/reasons/$id',
    loader: EditRoute.options.loader as never,
    preload: EditRoute.options.preload,
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

describe('reason edit loader', () => {
  it('opens on a fresh read of the reason and its pairs even after a hover preloaded the page', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(reasonDetailOptions('r1').queryKey, version('Old'));
    queryClient.setQueryData(validReasonsOptions('r1').queryKey, [pair(false)]);
    const server = { reason: version('At Hover'), pairs: [pair(false)] };
    vi.mocked(fetchReason).mockImplementation(() => later(server.reason));
    vi.mocked(fetchValidReasons).mockImplementation(() => later(server.pairs));
    const router = editRouter(queryClient);
    await router.load();

    await router.preloadRoute({ to: '/reasons/$id', params: { id: 'r1' } } as never);
    Object.assign(server, { reason: version('New'), pairs: [pair(true)] });
    await router.navigate({ to: '/reasons/$id', params: { id: 'r1' } } as never);

    expect(queryClient.getQueryData(reasonDetailOptions('r1').queryKey)).toEqual(version('New'));
    expect(queryClient.getQueryData(validReasonsOptions('r1').queryKey)).toEqual([pair(true)]);
  });
});

describe('reasons routes', () => {
  it('each check the right to manage reasons before loading', async () => {
    vi.mocked(fetchReason).mockResolvedValue(version('Damage'));
    vi.mocked(fetchValidReasons).mockResolvedValue([]);
    const queryClient = new QueryClient();
    const context = { context: { queryClient }, params: { id: 'r1' }, cause: 'enter' };

    for (const route of [ListRoute, AddRoute, EditRoute]) {
      vi.mocked(requireRight).mockClear();
      await (route.options.loader as (args: unknown) => Promise<unknown>)(context);
      expect(requireRight).toHaveBeenCalledWith(queryClient, 'STOCK_CARD_LINE_ITEM_REASONS_MANAGE');
    }
  });
});
