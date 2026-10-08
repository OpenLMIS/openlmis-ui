import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchUserDetails, updateUserRoles } from '@/features/users/api/api';
import type { UserDetails } from '@/features/users/lib/types';
import { Route } from '@/routes/(protected)/_protected.administration.users_.$id.roles';

vi.mock('@/components/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));
vi.mock('@/features/auth/lib/access', () => ({ requireRight: vi.fn(async () => new Set()) }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchRoles: vi.fn(async () => []),
  fetchPrograms: vi.fn(async () => []),
  fetchSupervisoryNodes: vi.fn(async () => []),
  fetchMinimalFacilities: vi.fn(async () => []),
}));
vi.mock('@/features/users/api/api', () => ({
  fetchUserDetails: vi.fn(),
  updateUserRoles: vi.fn(),
}));
vi.mock('@/features/users/components/role-dialogs', () => ({ RoleDialogs: () => null }));
vi.mock('@/features/users/components/role-tabs', () => ({
  RoleTabs: ({
    draft,
    onRemove,
  }: {
    draft: UserDetails['user']['roleAssignments'];
    onRemove: (row: unknown) => void;
  }) => (
    <button type="button" onClick={() => onRemove({ assignment: draft[0] })}>
      Remove Role
    </button>
  ),
  RoleTabsSkeleton: () => null,
}));

it('refuses the previous signed-in user Edit User Roles draft', async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'ada', username: 'ada', accessToken: 'token' });
  vi.mocked(fetchUserDetails).mockResolvedValue({
    user: {
      id: 'edited',
      username: 'edited',
      firstName: 'Edited',
      lastName: 'User',
      roleAssignments: [{ roleId: 'r1' }],
    },
    contact: null,
    auth: null,
  } as UserDetails);
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({ component: Outlet });
  const shell = createRoute({
    getParentRoute: () => root,
    id: '/(protected)/_protected',
    component: Outlet,
  });
  Route.update({
    getParentRoute: () => shell,
    id: '/administration/users_/$id/roles',
    path: '/administration/users/$id/roles',
  } as never);
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const router = createRouter({
    routeTree: root.addChildren([shell.addChildren([Route])]),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ['/administration/users/edited/roles'] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Remove Role' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /users.roles.save/ })).toBeEnabled(),
  );
  act(() =>
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'alan', username: 'alan', accessToken: 'other' }),
  );
  await userEvent.setup().click(screen.getByRole('button', { name: /users.roles.save/ }));
  expect(await screen.findByText('users.roles.save-error-title')).toBeInTheDocument();
  expect(updateUserRoles).not.toHaveBeenCalled();
});
