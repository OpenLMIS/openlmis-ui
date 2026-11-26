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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import type {
  NotificationsQuery,
  SavedNotification,
  SystemNotification,
} from '@/features/system-notifications/lib/types';
import { client } from '@/integrations/axios';
import { RIGHTS } from '@/lib/rights';
import { Route } from '@/routes/(protected)/_protected.administration.system-notifications';

HTMLElement.prototype.getAnimations ??= () => [];

const pagePath = '/administration/system-notifications';
const notice: SavedNotification = {
  id: '8b46ed1e-bc42-4af5-9bce-721bb71bb4db',
  author: { id: 'original-author' },
  createdDate: '2026-01-01T12:34:56.123456+01:00',
  active: true,
  title: 'Maintenance',
  message: 'Maintenance tonight',
};

beforeEach(() => {
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

function renderNotificationsPage(search: string) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
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
    path: 'administration/system-notifications',
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

function notificationsPage(rows: SystemNotification[], { page, size }: NotificationsQuery) {
  return {
    data: {
      content: rows.slice(page * size, (page + 1) * size),
      totalElements: rows.length,
      totalPages: Math.ceil(rows.length / size),
    },
  };
}

const editTitle = 'system-notifications.admin.edit-title';
const update = 'system-notifications.admin.update';
const adminPermissions = { data: [RIGHTS.systemNotificationsManage] };

it('edits an off-page notice through a direct link with notification management alone', async () => {
  const user = userEvent.setup();
  const saved = { ...notice, expiryDate: '2026-07-01T10:00:45.123Z' };
  const detailUrl = `/systemNotifications/${saved.id}`;
  const authorQuery = { authorId: saved.author.id, expand: 'author', page: 0, size: 1 };
  const get = vi.spyOn(client, 'get').mockImplementation(async (url, config) => {
    if (url === '/users/admin/permissionStrings') return adminPermissions;
    if (url === '/localeSettings') return { data: { timeZoneId: 'Europe/Warsaw' } };
    if (url === detailUrl) return { data: saved };
    if (url === '/systemNotifications') {
      const params = config?.params as NotificationsQuery;
      const rows = params.authorId
        ? [{ ...saved, author: { id: saved.author.id, firstName: 'Jane', lastName: 'Doe' } }]
        : [{ ...notice, id: 'other', title: 'Other notice' }];
      return notificationsPage(rows, params);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: saved });

  renderNotificationsPage(`?notification=${saved.id}`);

  const dialog = await screen.findByRole('dialog', { name: editTitle });
  expect(await within(dialog).findByText('Jane Doe')).toBeVisible();
  const expiry = within(dialog).getByLabelText(/system-notifications.admin.expiry-time/);
  expect(expiry).toHaveValue('12:00');
  fireEvent.change(expiry, { target: { value: '14:25' } });
  await user.click(within(dialog).getByRole('button', { name: update }));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());

  expect(put).toHaveBeenCalledExactlyOnceWith(detailUrl, {
    ...saved,
    startDate: null,
    expiryDate: '2026-07-01T12:25:59.999Z',
  });
  expect(
    get.mock.calls.filter(
      ([url, config]) =>
        url === '/systemNotifications' &&
        (config?.params as NotificationsQuery | undefined)?.authorId === saved.author.id,
    ),
  ).toEqual([['/systemNotifications', expect.objectContaining({ params: authorQuery })]]);
  await user.click(await screen.findByRole('button', { name: 'Filters' }));
  const filters = screen.getByRole('dialog', { name: 'Filters' });
  expect(
    within(filters).getByRole('checkbox', { name: 'system-notifications.admin.only-displayed' }),
  ).toBeVisible();
  expect(within(filters).queryByText('system-notifications.admin.author')).not.toBeInTheDocument();
  expect(get.mock.calls.map(([url]) => url)).not.toContain('/users');
});

it('clamps the filtered list after saving its last displayed notice on page two', async () => {
  const user = userEvent.setup();
  const first = { ...notice, id: 'first', title: 'First page notice' };
  let saved = {
    ...notice,
    startDate: '2099-01-01T00:00:00Z',
    author: { id: notice.author.id, firstName: 'Jane' },
  };
  vi.spyOn(client, 'get').mockImplementation(async (url, config) => {
    if (url === '/users/admin/permissionStrings') return adminPermissions;
    if (url === '/localeSettings') return { data: { timeZoneId: 'UTC' } };
    if (url === `/systemNotifications/${notice.id}`) return { data: saved };
    if (url === '/systemNotifications') {
      const params = config?.params as NotificationsQuery;
      return notificationsPage(
        params.isDisplayed && !saved.active ? [first] : [first, saved],
        params,
      );
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.spyOn(client, 'put').mockImplementation(async (_url, payload) => {
    saved = { ...saved, ...(payload as Pick<SavedNotification, 'active'>) };
    return { data: saved };
  });

  const router = renderNotificationsPage('?displayed=true&page=2&size=1');
  expect(await screen.findByText('Maintenance')).toBeVisible();
  expect(screen.getByText('system-notifications.admin.displayed')).toBeVisible();
  expect(screen.queryByText(first.title)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'system-notifications.admin.edit-name' }));

  const dialog = within(await screen.findByRole('dialog', { name: editTitle }));
  await user.click(
    await dialog.findByRole('switch', { name: 'system-notifications.admin.active' }),
  );
  await user.click(dialog.getByRole('button', { name: update }));

  expect(await screen.findByText(first.title)).toBeVisible();
  expect(screen.queryByText('Maintenance')).not.toBeInTheDocument();
  expect(router.state.location.search).toEqual({ displayed: true, size: 1 });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'system-notifications.admin.add-title' }),
    ).toHaveFocus(),
  );
});

it('retries a failed Author lookup when the filter is reopened', async () => {
  const user = userEvent.setup();
  let reads = 0;
  vi.spyOn(client, 'get').mockImplementation(async (url, config) => {
    if (url === '/users/admin/permissionStrings') {
      return { data: [RIGHTS.systemNotificationsManage, RIGHTS.usersManage] };
    }
    if (url === '/localeSettings') return { data: { timeZoneId: 'UTC' } };
    if (url === '/systemNotifications')
      return notificationsPage([], config?.params as NotificationsQuery);
    if (url === '/users') {
      reads += 1;
      if (reads === 1) throw new Error('Unavailable');
      return { data: { content: [{ id: notice.author.id, firstName: 'Jane', username: 'jdoe' }] } };
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  renderNotificationsPage('');

  await user.click(await screen.findByRole('button', { name: 'Filters' }));
  const author = screen.getByRole('combobox', { name: 'system-notifications.admin.author' });
  await user.click(author);
  expect(await screen.findByText('system-notifications.admin.authors-error')).toBeVisible();
  await user.keyboard('{Escape}');
  await user.click(author);
  expect(await screen.findByRole('option', { name: /Jane/ })).toBeVisible();
  expect(reads).toBe(2);
});
