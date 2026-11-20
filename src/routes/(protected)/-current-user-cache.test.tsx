import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance, type i18n } from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, expect, it, vi } from 'vitest';
import { NavUser } from '@/components/app-shell/nav-user';
import { OfflineNavigationProvider } from '@/components/app-shell/offline-navigation';
import { useLoginData } from '@/features/auth/store/login-data';
import { systemNotificationsOptions } from '@/features/system-notifications/api/queries';
import { userMatchesOptions, usersListOptions } from '@/features/users/api/queries';
import { client } from '@/integrations/axios';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { queryKeys, userProgramsKey, userRecordKey, userRightsKey } from '@/lib/key-factory';
import { parsePermissions } from '@/lib/permissions';
import type { UserRecord } from '@/lib/user-types';
import { Route as HomeRoute } from '@/routes/(protected)/_protected.home';
import { Route as ProfileRoute } from '@/routes/(protected)/_protected.profile';
import { Route as ProfileIndexRoute } from '@/routes/(protected)/_protected.profile.index';
import { Route as ProfileNotificationsRoute } from '@/routes/(protected)/_protected.profile.notifications';
import { offlineAccessFixture } from '@/test-utils/offline-access';

import en from '../../../public/locales/en.json';

const userRecord: UserRecord = {
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
ProfileNotificationsRoute.update({
  getParentRoute: () => ProfileRoute,
  path: '/notifications',
} as never);
const tree = root.addChildren([
  protectedGroup.addChildren([
    layout.addChildren([
      HomeRoute,
      ProfileRoute.addChildren([ProfileIndexRoute, ProfileNotificationsRoute]),
    ] as never),
  ] as never),
] as never);

function openPage({
  seedUser = false,
  path = '/home',
  translations,
}: {
  seedUser?: boolean;
  path?: string;
  translations?: i18n;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, networkMode: 'always' } },
  });
  queryClient.setQueryDefaults(userRightsKey(userRecord.id), { staleTime: Infinity });
  queryClient.setQueryData(userRightsKey(userRecord.id), parsePermissions([]));
  if (seedUser) queryClient.setQueryData(userRecordKey(userRecord.id), userRecord);
  const router = createRouter({
    routeTree: tree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  } as never) as AnyRouter;
  const page = (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  render(translations ? <I18nextProvider i18n={translations}>{page}</I18nextProvider> : page, {
    onCaughtError: () => undefined,
  });
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
    if (url === '/digestConfiguration') return { data: { content: [] } };
    if (url === '/systemNotifications') return { data: { content: [], totalPages: 0 } };
    if (url.startsWith('/userContactDetails/')) return { data: null };
    return { data: [] };
  });
});

it('refreshes the shell notification list when refreshing Home', async () => {
  const pending = Promise.withResolvers<{ data: { content: unknown[]; totalPages: number } }>();
  const get = vi.mocked(client.get).getMockImplementation();
  vi.mocked(client.get).mockImplementation(async (url, config) =>
    url === '/systemNotifications' ? pending.promise : get?.(url, config),
  );
  const cache = openPage();
  const options = systemNotificationsOptions();
  const { queryKey } = options;
  cache.setQueryData(queryKey, []);
  const observer = new QueryObserver(cache, { ...options, staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  try {
    const refresh = await screen.findByRole('button', { name: 'home.refresh' });
    await waitFor(() => expect(refresh).toBeEnabled());
    await userEvent.click(refresh);
    expect(client.get).toHaveBeenCalledWith('/systemNotifications', expect.anything());
    expect(refresh).toBeDisabled();
    expect(cache.getQueryData(queryKey)).toEqual([]);
    const notice = { id: 'published', title: 'New Notice', message: 'Maintenance tonight' };
    pending.resolve({ data: { content: [notice], totalPages: 1 } });
    await waitFor(() => expect(refresh).toBeEnabled());
    expect(cache.getQueryData(queryKey)).toEqual([notice]);
  } finally {
    unsubscribe();
  }
});

const userReads = () => vi.mocked(client.get).mock.calls.filter(([url]) => url === '/users/u1');

it('shares the warm user across Home, the avatar menu and Profile', async () => {
  openPage({ seedUser: true });
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
  const queryClient = openPage({ seedUser: true });
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
      ? {
          data: put.mock.lastCall
            ? { phoneNumber: '0123', referenceDataUserId: 'u1', emailDetails: null }
            : null,
        }
      : get?.(url, config),
  );

  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'home.welcome-name' });
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(await screen.findByRole('menuitem', { name: 'nav-user.account' }));
  await user.type(await screen.findByRole('textbox', { name: 'users.form.phone-number' }), '123');
  const save = screen.getByRole('button', { name: 'profile.save' });
  await user.click(save);

  await screen.findByDisplayValue('0123');
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

async function homeTranslations() {
  const translations = createInstance().use(ICU);
  await translations.init({
    lng: 'en',
    keySeparator: false,
    nsSeparator: false,
    resources: {
      en: {
        translation: {
          'home.title': en['home.title'],
          'home.welcome-name': en['home.welcome-name'],
        },
      },
    },
  });
  return translations;
}

it('shows the changed server name when Home is refreshed', async () => {
  const get = vi.mocked(client.get).getMockImplementation();
  vi.mocked(client.get).mockImplementation(async (url, config) =>
    url === '/users/u1' ? { data: { ...userRecord, firstName: 'Augusta' } } : get?.(url, config),
  );
  openPage({ seedUser: true, translations: await homeTranslations() });
  await screen.findByRole('heading', { name: 'Welcome Back, Ada' });
  const refresh = await screen.findByRole('button', { name: 'home.refresh' });
  await waitFor(() => expect(refresh).toBeEnabled());
  await userEvent.click(refresh);
  await screen.findByRole('heading', { name: 'Welcome Back, Augusta' });
  expect(userReads()).toHaveLength(1);
});

it('refreshes notice authors and cached user search after a Profile name save', async () => {
  let serverUser = { ...userRecord, lastName: 'Byron' };
  const notification = { id: 'notice', title: 'Published', message: 'Maintenance' };
  const pending = Promise.withResolvers<void>();
  const get = vi.mocked(client.get).getMockImplementation();
  vi.mocked(client.get).mockImplementation(async (url, config) => {
    if (url === '/systemNotifications') {
      await pending.promise;
      return { data: { content: [{ ...notification, author: serverUser }], totalPages: 1 } };
    }
    if (url === '/users/u1') return { data: serverUser };
    if (url === '/userContactDetails') return { data: { content: [] } };
    if (url === '/users') {
      const params = config?.params as { firstName?: string } | undefined;
      return { data: { content: params?.firstName === serverUser.firstName ? [serverUser] : [] } };
    }
    return get?.(url, config);
  });
  vi.spyOn(client, 'put').mockImplementation(async (_url, data) => {
    serverUser = data as UserRecord;
    return { data: undefined };
  });
  vi.spyOn(client, 'post').mockImplementation(async () => ({ data: { content: [serverUser] } }));
  const queryClient = openPage({ seedUser: true, path: '/profile' });
  const options = systemNotificationsOptions();
  queryClient.setQueryData(options.queryKey, [{ ...notification, author: serverUser }]);
  const observer = new QueryObserver(queryClient, { ...options, staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  try {
    const search = usersListOptions({ page: 0, size: 20, sort: 'username,asc', q: 'Augusta' });
    queryClient.setQueryDefaults(userMatchesOptions('Augusta').queryKey, { staleTime: Infinity });
    const firstName = await screen.findByRole('textbox', { name: /users.form.first-name/ });
    expect((await queryClient.fetchQuery(search)).content).toEqual([]);

    const user = userEvent.setup();
    await user.clear(firstName);
    await user.type(firstName, 'Augusta');
    const save = screen.getByRole('button', { name: 'profile.save' });
    await user.click(save);
    await waitFor(() =>
      expect(queryClient.getQueryState(search.queryKey)?.isInvalidated).toBe(true),
    );

    await waitFor(() => expect(save).toBeDisabled());
    expect(queryClient.getQueryState(options.queryKey)?.fetchStatus).toBe('fetching');
    await act(async () => pending.resolve());
    await waitFor(() =>
      expect(queryClient.getQueryData(options.queryKey)?.[0]?.author?.firstName).toBe('Augusta'),
    );
    expect(screen.getByRole('textbox', { name: /users.form.last-name/ })).toHaveValue('Byron');
    expect((await queryClient.fetchQuery(search)).content).toEqual([
      expect.objectContaining({ id: 'u1', firstName: 'Augusta' }),
    ]);
  } finally {
    unsubscribe();
    pending.resolve();
  }
});

it.each([
  ['/profile', 'users.form.first-name'],
  ['/profile/notifications', 'profile.notifications.empty-title'],
])(
  'keeps the profile tabs visible while contact details load and retries a failure at %s',
  async (path, loadedLabel) => {
    const read = Promise.withResolvers<{ data: null }>();
    const get = vi.mocked(client.get).getMockImplementation();
    vi.mocked(client.get).mockImplementation(async (url, config) =>
      url === '/userContactDetails/u1' ? read.promise : get?.(url, config),
    );
    openPage({ seedUser: true, path });

    const panel = await screen.findByRole('tabpanel');
    await waitFor(() => expect(panel.querySelector('[aria-busy="true"]')).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'profile.tabs.basic' })).toBeInTheDocument();
    vi.mocked(client.get).mockImplementation(async (url, config) =>
      url === '/userContactDetails/u1'
        ? { data: { referenceDataUserId: 'u1', emailDetails: null } }
        : get?.(url, config),
    );
    await act(async () => read.reject(new Error('contact request failed')));
    expect(await screen.findByText('profile.error-title')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'profile.tabs.basic' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText(loadedLabel)).toBeInTheDocument();
    expect(screen.queryByText('profile.error-title')).not.toBeInTheDocument();
  },
);

it.each([true, false])('renders Home offline with a saved access snapshot: %s', async (saved) => {
  const table = getLocalDb().table(LOCAL_TABLES.offlineAccess);
  await table.clear();
  try {
    if (saved) {
      await table.put({ ...offlineAccessFixture({ userId: userRecord.id }), user: userRecord });
    }
    onlineManager.setOnline(false);
    const queryClient = openPage({ translations: await homeTranslations() });
    await screen.findByRole('heading', { name: saved ? 'Welcome Back, Ada' : en['home.title'] });
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
