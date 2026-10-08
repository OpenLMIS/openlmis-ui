import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchDigestConfigurations,
  fetchProfile,
  fetchSubscriptions,
  saveProfile,
  saveSubscriptions,
} from '@/features/profile/api/api';
import { profileOptions, subscriptionsOptions } from '@/features/profile/api/queries';
import { BasicInformation } from '@/features/profile/components/basic-information';
import { NotificationSettings } from '@/features/profile/components/notification-settings';
import { ProfileWorkspace } from '@/features/profile/components/profile-workspace';
import { queryClient } from '@/integrations/tanstack-query';
import { Route } from '@/routes/(protected)/_protected';

vi.mock('@/features/profile/api/api', () => ({
  saveProfile: vi.fn(),
  fetchProfile: vi.fn(),
  fetchPendingEmail: vi.fn().mockResolvedValue(null),
  resendVerification: vi.fn(),
  fetchSubscriptions: vi.fn(),
  saveSubscriptions: vi.fn(),
  fetchDigestConfigurations: vi.fn(),
}));
vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/app-shell-skeleton', () => ({
  AppShellSkeleton: () => <p>Checking access</p>,
}));
vi.mock('@/components/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));

const ada = { referenceDataUserId: 'u1', username: 'ada', accessToken: 'ada-token' };
const alan = { referenceDataUserId: 'u2', username: 'alan', accessToken: 'alan-token' };
const profile = {
  user: {
    id: 'u1',
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    active: true,
    roleAssignments: [],
  },
  contact: null,
};
const onSaved = vi.fn();
let notifications = false;
function Page() {
  return useLoginData.getState().referenceDataUserId === 'u1' ? (
    <ProfileWorkspace username="ada">
      {notifications ? (
        <NotificationSettings hasContactDetails userId="u1" />
      ) : (
        <BasicInformation onSaved={onSaved} profile={profile} />
      )}
    </ProfileWorkspace>
  ) : (
    <p>Alan page</p>
  );
}
const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({ component: Outlet });
Route.update({ getParentRoute: () => root, id: '/(protected)/_protected' } as never);
const page = createRoute({ getParentRoute: () => Route, path: '/review', component: Page });
const tree = root.addChildren([Route.addChildren([page])]);
async function open() {
  const router = createRouter({
    routeTree: tree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ['/review'] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
afterEach(() => {
  queryClient.clear();
  queryClient.setDefaultOptions({});
});
beforeEach(() => {
  useLoginData.getState().setLoginData(ada);
  queryClient.clear();
  queryClient.setDefaultOptions({
    queries: { staleTime: Infinity, retry: false },
    mutations: { retry: 0 },
  });
  vi.mocked(saveProfile).mockResolvedValue();
  vi.mocked(saveSubscriptions).mockResolvedValue();
  vi.mocked(fetchProfile).mockReturnValue(new Promise(() => {}));
  vi.mocked(fetchDigestConfigurations).mockResolvedValue([
    { id: 'd1', tag: 'requisition-actionRequired' },
  ]);
  vi.mocked(fetchSubscriptions).mockResolvedValue([
    { digestConfiguration: { id: 'd1' }, preferredChannel: 'SMS', useDigest: false },
  ]);
});
it('profile completion must not repopulate the previous identity cache after the shared boundary unmounts', async () => {
  notifications = false;
  queryClient.setQueryData(profileOptions('u1').queryKey, profile);
  const user = await open();
  await user.type(await screen.findByRole('textbox', { name: /users.form.first-name/ }), 'x');
  await user.click(screen.getByRole('button', { name: 'profile.save' }));
  await waitFor(() => expect(fetchProfile).toHaveBeenCalledOnce());
  act(() => useLoginData.getState().setLoginData(alan));
  await screen.findByText('Alan page');
  expect(queryClient.getQueryData(profileOptions('u1').queryKey)).toBeUndefined();
  expect(onSaved).not.toHaveBeenCalled();
});
it('notification completion must not repopulate the previous identity cache after the shared boundary unmounts', async () => {
  notifications = true;
  const user = await open();
  await user.click(await screen.findByRole('switch', { name: /use-digest/ }));
  vi.mocked(fetchSubscriptions).mockReturnValue(new Promise(() => {}));
  await user.click(screen.getByRole('button', { name: 'profile.notifications.save' }));
  await waitFor(() => expect(fetchSubscriptions).toHaveBeenCalledTimes(2));
  act(() => useLoginData.getState().setLoginData(alan));
  await screen.findByText('Alan page');
  expect(queryClient.getQueryData(subscriptionsOptions('u1').queryKey)).toBeUndefined();
});
