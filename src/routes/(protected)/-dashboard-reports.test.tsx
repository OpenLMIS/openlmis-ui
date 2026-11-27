// @vitest-environment jsdom
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
import { getI18n } from 'react-i18next';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import type { ManagedDashboardReport } from '@/features/dashboard-reports/lib/types';
import { client } from '@/integrations/axios';
import { RIGHTS } from '@/lib/rights';
import { Route } from '@/routes/(protected)/_protected.administration.reports';
import en from '../../../public/locales/en.json';

HTMLElement.prototype.getAnimations ??= () => [];

const pagePath = '/administration/reports';
const listUrl = '/reports/dashboardReports';
const firstCategory = { id: 'first', name: 'First' };
const secondCategory = { id: 'second', name: 'Second' };
const report = (id: string, name: string, category = secondCategory): ManagedDashboardReport => ({
  id,
  name,
  category,
  type: 'POWERBI',
  enabled: true,
  showOnHomePage: false,
  url: 'https://reports.example.org',
});
const stock = report('8b46ed1e-bc42-4af5-9bce-721bb71bb4db', 'Stock');
const orders = report('9734a36c-6a18-45f7-bae8-321ea03818c4', 'Orders', firstCategory);
const finance = report('3c3a9b1e-52a4-4b5f-9d0e-7a1f0c2d4e6b', 'Finance');
const detailUrl = `${listUrl}/${stock.id}`;
const deleteLabel = 'dashboard-reports.delete';
const deleteTitle = 'dashboard-reports.delete.title';
const deleteDescription = 'dashboard-reports.delete.description';

beforeEach(() => {
  getI18n().addResource(
    'en',
    'translation',
    deleteDescription,
    en[deleteDescription].replace('{name}', '{{name}}'),
  );
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

function renderReportsPage(search: string) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const page = createRoute({
    validateSearch: Route.options.validateSearch,
    loader: Route.options.loader as never,
    staticData: Route.options.staticData,
    component: Route.options.component,
    pendingComponent: Route.options.pendingComponent,
    getParentRoute: () => layout,
    path: 'administration/reports',
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([page] as never)] as never),
    ] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [pagePath + search] }),
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

function mockList(getRows: () => ManagedDashboardReport[], detail?: Promise<unknown>) {
  return vi.spyOn(client, 'get').mockImplementation(async (url, config) => {
    if (url === '/users/admin/permissionStrings') return { data: [RIGHTS.reportsManage] };
    if (url === detailUrl && detail) return detail;
    if (url !== listUrl) throw new Error(`Unexpected request: ${url}`);
    expect(config?.params).toBeUndefined();
    return { data: { content: getRows() } };
  });
}

it('sorts names and categories locally across pages without sending list parameters', async () => {
  const user = userEvent.setup();
  const get = mockList(() => [stock, finance, orders]);
  renderReportsPage('?page=2&size=1');

  expect(await screen.findByRole('cell', { name: 'Orders' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'dashboard-reports.name' }));
  expect(await screen.findByRole('cell', { name: 'Stock' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'dashboard-reports.category' }));
  expect(await screen.findByRole('cell', { name: 'Orders' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Next Page' }));
  expect(await screen.findByRole('cell', { name: 'Finance' })).toBeVisible();
  expect(get.mock.calls.filter(([url]) => url === listUrl)).toEqual([
    [listUrl, { signal: expect.any(AbortSignal) }],
  ]);
});

it('reads the current name when Forward interrupts a row Delete closing animation', async () => {
  const user = userEvent.setup();
  const closing = Promise.withResolvers<Animation>();
  const animation = { finished: closing.promise } as Animation;
  const closingAnimation = vi.fn(() => [animation]);
  vi.spyOn(HTMLElement.prototype, 'getAnimations').mockImplementation(function (this: HTMLElement) {
    return this.matches('[data-slot="alert-dialog-content"][data-closed]')
      ? closingAnimation()
      : [];
  });
  const fresh = { ...stock, name: 'Warehouse' };
  const get = mockList(() => [stock], Promise.resolve({ data: fresh }));
  const router = renderReportsPage('');

  await user.click(await screen.findByRole('button', { name: deleteLabel }));
  const popup = await screen.findByRole('alertdialog', { name: deleteTitle });
  const dialog = within(popup);
  expect(dialog.getByText(/Stock/)).toBeVisible();
  expect(get).not.toHaveBeenCalledWith(detailUrl, expect.anything());
  await user.click(dialog.getByRole('button', { name: 'dialog.cancel' }));
  await waitFor(() => expect(closingAnimation).toHaveBeenCalled());
  expect(router.state.location.search).toEqual({});
  expect(dialog.getByText(/Stock/)).toBeInTheDocument();

  await act(async () => router.history.forward());

  await waitFor(() => expect(get).toHaveBeenCalledWith(detailUrl, expect.anything()));
  const reopened = within(await screen.findByRole('alertdialog', { name: deleteTitle }));
  expect(await reopened.findByText(/Warehouse/)).toBeVisible();
  await act(async () => closing.resolve(animation));
});

it('closes Delete and replaces the page after deleting its only row', async () => {
  const user = userEvent.setup();
  let rows = [finance, orders, stock];
  const get = mockList(() => rows);
  vi.spyOn(client, 'delete').mockImplementation(async () => {
    rows = [finance, orders];
    return { status: 204 };
  });
  const router = renderReportsPage('?page=3&size=1');

  await user.click(await screen.findByRole('button', { name: deleteLabel }));
  const dialog = await screen.findByRole('alertdialog', { name: deleteTitle });
  await user.click(within(dialog).getByRole('button', { name: deleteLabel }));

  expect(await screen.findByRole('cell', { name: 'Orders' })).toBeVisible();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(router.state.location.search).toEqual({ page: 2, size: 1 });
  expect(router.history.canGoBack()).toBe(false);
  expect(get.mock.calls.filter(([url]) => url === listUrl)).toHaveLength(2);
});
