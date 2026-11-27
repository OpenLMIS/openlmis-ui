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
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { useLoginData } from '@/features/auth/store/login-data';
import type { ReportCategoriesQuery, ReportCategory } from '@/features/report-categories/lib/types';
import { client } from '@/integrations/axios';
import { RIGHTS } from '@/lib/rights';
import { Route } from '@/routes/(protected)/_protected.administration.report-categories';

HTMLElement.prototype.getAnimations ??= () => [];

const pagePath = '/administration/report-categories';
const listUrl = '/reports/reportCategories';
const stock = { id: '8b46ed1e-bc42-4af5-9bce-721bb71bb4db', name: 'Stock' };
const orders = { id: '9734a36c-6a18-45f7-bae8-321ea03818c4', name: 'Orders' };
const finance = { id: '3c3a9b1e-52a4-4b5f-9d0e-7a1f0c2d4e6b', name: 'Finance' };
const detailUrl = `${listUrl}/${stock.id}`;
const inUseKey = 'api-error.report.error.reportCategory.already.assigned';
const deleteLabel = 'report-categories.delete';
const deleteTitle = 'report-categories.delete.title';
const deleteDescription = 'report-categories.delete.description';

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

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderCategoriesPage(search: string) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const queryClient = makeQueryClient();
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
    path: 'administration/report-categories',
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

function mockList(getRows: () => ReportCategory[], detail?: Promise<unknown>) {
  return vi.spyOn(client, 'get').mockImplementation(async (url, config) => {
    if (url === '/users/admin/permissionStrings') return { data: [RIGHTS.reportCategoriesManage] };
    if (url === detailUrl && detail) return detail;
    if (url !== listUrl) throw new Error(`Unexpected request: ${url}`);
    const params = config?.params as ReportCategoriesQuery | undefined;
    if (!params) throw new Error('Expected pagination and sorting parameters');
    const { page, size, sort } = params;
    const rows = getRows().toSorted((a, b) =>
      sort === 'name,desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
    );
    return {
      data: {
        content: rows.slice(page * size, (page + 1) * size),
        totalElements: rows.length,
        totalPages: Math.ceil(rows.length / size),
      },
    };
  });
}

it('pages and sorts the category list on the server', async () => {
  const user = userEvent.setup();
  const get = mockList(() => [stock, orders]);
  renderCategoriesPage('?page=2&size=1');

  expect(await screen.findByRole('cell', { name: 'Stock' })).toBeVisible();
  expect(get).toHaveBeenCalledWith(
    listUrl,
    expect.objectContaining({ params: { page: 1, size: 1, sort: 'name,asc' } }),
  );

  await user.click(screen.getByRole('button', { name: 'report-categories.name' }));
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      listUrl,
      expect.objectContaining({ params: { page: 0, size: 1, sort: 'name,desc' } }),
    ),
  );
});

it('keeps an in-use category and toasts the translated refusal', async () => {
  const user = userEvent.setup();
  const get = mockList(() => [stock]);
  getI18n().addResource('en', 'translation', inUseKey, en[inUseKey]);
  const remove = vi.spyOn(client, 'delete').mockRejectedValue({
    isAxiosError: true,
    response: {
      status: 400,
      data: {
        messageKey: 'report.error.reportCategory.already.assigned',
        message: `Category is assigned: ${stock.id}`,
      },
    },
  });
  const toastError = vi.spyOn(toast, 'error');
  renderCategoriesPage('');

  await user.click(await screen.findByRole('button', { name: deleteLabel }));
  const dialog = await screen.findByRole('alertdialog', { name: deleteTitle });
  await user.click(within(dialog).getByRole('button', { name: deleteLabel }));

  await waitFor(() =>
    expect(toastError).toHaveBeenCalledWith('report-categories.delete.error-title', {
      description: en[inUseKey],
    }),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(remove).toHaveBeenCalledWith(detailUrl);
  expect(get).not.toHaveBeenCalledWith(detailUrl, expect.anything());
  expect(screen.getByRole('cell', { name: 'Stock', hidden: true })).toBeInTheDocument();
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
  const router = renderCategoriesPage('');

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
  const router = renderCategoriesPage('?page=3&size=1');

  await user.click(await screen.findByRole('button', { name: deleteLabel }));
  const dialog = await screen.findByRole('alertdialog', { name: deleteTitle });
  await user.click(within(dialog).getByRole('button', { name: deleteLabel }));

  expect(await screen.findByRole('cell', { name: 'Orders' })).toBeVisible();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(router.state.location.search).toEqual({ page: 2, size: 1 });
  expect(router.history.canGoBack()).toBe(false);
  expect(get).toHaveBeenCalledWith(
    listUrl,
    expect.objectContaining({ params: { page: 1, size: 1, sort: 'name,asc' } }),
  );
});

it('waits for a direct Delete link to load and shows when the category is missing', async () => {
  const detail = Promise.withResolvers<never>();
  const get = mockList(() => [], detail.promise);
  renderCategoriesPage(`?delete=${stock.id}`);

  const dialog = within(await screen.findByRole('alertdialog'));
  expect(dialog.getByRole('button', { name: deleteLabel })).toBeDisabled();
  expect(get).toHaveBeenCalledWith(detailUrl, expect.anything());
  await act(async () => detail.reject({ isAxiosError: true, response: { status: 404 } }));

  expect(await dialog.findByText('api-error.report.error.reportCategory.notFound')).toBeVisible();
  expect(dialog.getByRole('button', { name: 'dialog.close' })).toBeEnabled();
  expect(dialog.queryByRole('button', { name: deleteLabel })).not.toBeInTheDocument();
});

it('enables Delete once a direct link has loaded the category', async () => {
  mockList(() => [], Promise.resolve({ data: stock }));
  renderCategoriesPage(`?delete=${stock.id}`);

  const dialog = within(await screen.findByRole('alertdialog', { name: deleteTitle }));
  expect(await dialog.findByText(/Stock/)).toBeVisible();
  expect(dialog.getByRole('button', { name: deleteLabel })).toBeEnabled();
});

it('names a refused Delete dialog No Access and explains the required right', async () => {
  const title = 'report-categories.form.no-access-title';
  const description = 'report-categories.form.no-access';
  const detail = Promise.withResolvers<never>();
  getI18n().addResource('en', 'translation', title, en[title]);
  getI18n().addResource('en', 'translation', description, en[description]);
  mockList(() => [], detail.promise);
  renderCategoriesPage(`?delete=${stock.id}`);

  await screen.findByRole('alertdialog');
  await act(async () => detail.reject({ isAxiosError: true, response: { status: 403 } }));

  const dialog = await screen.findByRole('alertdialog', { name: 'No Access' });
  expect(dialog).toHaveAccessibleDescription(en[description]);
  expect(within(dialog).getByText(en[description]).closest('.line-clamp-4')).toBeNull();
});
