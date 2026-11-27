import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, render } from '@testing-library/react';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, vi } from 'vitest';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import type { BuqCatalogRecord } from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';
import { parsePermissions } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import { Route } from '@/routes/(protected)/_protected.administration.manage-buq';

export const remarksUrl = '/remark';
export const sourcesUrl = '/sourcesOfFunds';
export const catalogRecord = (index: number, name: string, editable = true): BuqCatalogRecord => ({
  id: `8b46ed1e-bc42-4af5-9bce-${String(index).padStart(12, '0')}`,
  name,
  description: null,
  editable,
});

export function setupManageBuqTests() {
  beforeEach(() => {
    HTMLElement.prototype.getAnimations ??= () => [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'admin',
      username: 'ada',
      accessToken: 'token',
    });
  });

  afterEach(() => {
    cleanup();
    useLoginData.getState().clearLoginData();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
}

export async function renderManageBuq(
  search = '',
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  }),
) {
  queryClient.setQueryData(
    permissionsOptions('admin').queryKey,
    parsePermissions([RIGHTS.manageBuq]),
  );
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const page = createRoute({
    validateSearch: Route.options.validateSearch,
    loaderDeps: Route.options.loaderDeps as never,
    loader: Route.options.loader as never,
    staticData: Route.options.staticData,
    component: Route.options.component,
    pendingComponent: Route.options.pendingComponent,
    getParentRoute: () => layout,
    path: 'administration/manage-buq',
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([page] as never)] as never),
    ] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [`/administration/manage-buq${search}`] }),
  } as never) as AnyRouter;
  await router.load();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

export function mockCatalogs(
  rows: (url: string) => BuqCatalogRecord[],
  detail?: (url: string) => BuqCatalogRecord | Promise<BuqCatalogRecord>,
) {
  return vi.spyOn(client, 'get').mockImplementation(async (url, config) => {
    if (url === remarksUrl) return { data: rows(url) };
    if (url === sourcesUrl) {
      const records = rows(url);
      const { page, size }: { page?: unknown; size?: unknown } = config?.params ?? {};
      if (typeof page !== 'number' || typeof size !== 'number') {
        throw new Error('Expected page and size on source lookup');
      }
      return {
        data: {
          content: records.slice(page * size, (page + 1) * size),
          totalPages: Math.ceil(records.length / size),
        },
      };
    }
    if (detail) return { data: await detail(url) };
    const list = url.slice(0, url.lastIndexOf('/'));
    const match = rows(list).find(({ id }) => url === `${list}/${id}`);
    if (match) return { data: match };
    throw new Error(`Unexpected request: ${url}`);
  });
}

export function catalogError(status: number, messageKey?: string) {
  return Object.assign(new AxiosError('Request failed'), {
    response: { status, data: { messageKey } },
  });
}
