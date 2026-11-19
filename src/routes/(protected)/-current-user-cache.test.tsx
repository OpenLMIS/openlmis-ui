import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { NavUser } from '@/components/app-shell/nav-user';
import { OfflineNavigationProvider } from '@/components/app-shell/offline-navigation';
import { useLoginData } from '@/features/auth/store/login-data';
import { client } from '@/integrations/axios';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { queryKeys, userProgramsKey, userRecordKey, userRightsKey } from '@/lib/key-factory';
import { parsePermissions } from '@/lib/permissions';
import { Route as HomeRoute } from '@/routes/(protected)/_protected.home';
import { Route as ProfileRoute } from '@/routes/(protected)/_protected.profile';
import { Route as ProfileIndexRoute } from '@/routes/(protected)/_protected.profile.index';
import { offlineAccessFixture } from '@/test-utils/offline-access';

const userRecord = {
  id: 'u1',
  username: 'ada',
  firstName: 'Ada',
  lastName: 'Lovelace',
  active: true,
  roleAssignments: [],
};

const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <OfflineNavigationProvider>
      <NavUser trigger={<button type="button">Menu</button>} />
      <Outlet />
    </OfflineNavigationProvider>
  ),
});
const protectedGroup = createRoute({ getParentRoute: () => root, id: '(protected)' });
const layout = createRoute({ getParentRoute: () => protectedGroup, id: '_protected' });
HomeRoute.update({ getParentRoute: () => layout, path: '/home' } as never);
ProfileRoute.update({ getParentRoute: () => layout, path: '/profile' } as never);
ProfileIndexRoute.update({ getParentRoute: () => ProfileRoute, path: '/' } as never);
const tree = root.addChildren([
  protectedGroup.addChildren([
    layout.addChildren([HomeRoute, ProfileRoute.addChildren([ProfileIndexRoute])] as never),
  ] as never),
] as never);

function openHome(seedUser = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, networkMode: 'always' } },
  });
  queryClient.setQueryData(userRightsKey(userRecord.id), parsePermissions([]));
  if (seedUser) queryClient.setQueryData(userRecordKey(userRecord.id), userRecord);
  const router = createRouter({
    routeTree: tree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ['/home'] }),
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  useLoginData.getState().setLoginData({
    referenceDataUserId: userRecord.id,
    username: userRecord.username,
    accessToken: 'token',
  });
  vi.spyOn(client, 'get').mockImplementation(async (url) => {
    if (url === '/users/u1') return { data: userRecord };
    if (url === '/systemNotifications') return { data: { content: [], totalPages: 0 } };
    if (url.startsWith('/userContactDetails/')) return { data: null };
    return { data: [] };
  });
});

const userReads = () => vi.mocked(client.get).mock.calls.filter(([url]) => url === '/users/u1');

it('shares the warm user across Home, the avatar menu and Profile', async () => {
  openHome(true);
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'home.welcome-name' });
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  await user.click(screen.getByRole('menuitem', { name: 'nav-user.account' }));
  expect(await screen.findByRole('textbox', { name: /users.form.first-name/ })).toHaveValue('Ada');
  expect(client.get).toHaveBeenCalledWith('/userContactDetails/u1');
  expect(userReads()).toHaveLength(0);
});

it('refreshes saved contact details and invalidates only the Users admin entries', async () => {
  const queryClient = openHome(true);
  const adminList = queryKeys.users.list({ page: 0 });
  const adminDetail = queryKeys.users.detail(userRecord.id);
  const programs = userProgramsKey(userRecord.id);
  queryClient.setQueryData(adminList, []);
  queryClient.setQueryData(adminDetail, { user: userRecord });
  queryClient.setQueryData(programs, []);
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: undefined });
  const get = vi.mocked(client.get).getMockImplementation();
  vi.mocked(client.get).mockImplementation(async (url, config) =>
    url === '/userContactDetails/u1'
      ? { data: put.mock.lastCall?.[1] ?? null }
      : get?.(url, config),
  );

  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'home.welcome-name' });
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(await screen.findByRole('menuitem', { name: 'nav-user.account' }));
  await user.type(await screen.findByRole('textbox', { name: 'users.form.phone-number' }), '123');
  const save = screen.getByRole('button', { name: 'profile.save' });
  await user.click(save);

  await waitFor(() => expect(save).toBeDisabled());
  expect(client.put).toHaveBeenCalledExactlyOnceWith(
    '/userContactDetails/u1',
    expect.objectContaining({ phoneNumber: '123' }),
  );
  expect(
    vi.mocked(client.get).mock.calls.filter(([url]) => url === '/userContactDetails/u1'),
  ).toHaveLength(2);
  expect(userReads()).toHaveLength(0);
  expect(queryClient.getQueryState(adminList)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(adminDetail)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(programs)?.isInvalidated).toBe(false);
});

it('refetches the shared user when Home is refreshed', async () => {
  const queryClient = openHome(true);
  const refresh = await screen.findByRole('button', { name: 'home.refresh' });
  await waitFor(() => expect(refresh).toBeEnabled());
  await userEvent.click(refresh);
  await waitFor(() => expect(userReads()).toHaveLength(1));
  await waitFor(() =>
    expect(queryClient.getQueryState(userRecordKey(userRecord.id))?.fetchStatus).toBe('idle'),
  );
});

it.each([true, false])('renders Home offline with a saved access snapshot: %s', async (saved) => {
  const table = getLocalDb().table(LOCAL_TABLES.offlineAccess);
  await table.clear();
  try {
    if (saved) {
      await table.put({ ...offlineAccessFixture({ userId: userRecord.id }), user: userRecord });
    }
    onlineManager.setOnline(false);
    const queryClient = openHome();
    await screen.findByRole('heading', { name: saved ? 'home.welcome-name' : 'home.title' });
    await waitFor(() =>
      expect(queryClient.getQueryState(userRecordKey(userRecord.id))?.status).toBe(
        saved ? 'success' : 'error',
      ),
    );
    expect(userReads()).toHaveLength(0);
  } finally {
    await table.clear();
  }
});
