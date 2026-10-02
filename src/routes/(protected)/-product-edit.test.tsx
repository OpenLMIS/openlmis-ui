import { QueryClient } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProduct } from '@/features/products/api/api';
import { productDetailOptions } from '@/features/products/api/queries';
import type { ProductDetail } from '@/features/products/lib/types';
import { Route } from '@/routes/(protected)/_protected.administration.products_.$id';

vi.mock('@/features/auth/lib/access', () => ({
  requireRight: vi.fn(async () => new Set(['ORDERABLES_MANAGE'])),
}));
vi.mock('@/features/products/api/api', () => ({ fetchProduct: vi.fn() }));

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
