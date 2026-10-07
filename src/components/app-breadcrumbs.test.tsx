import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppBreadcrumbs } from '@/components/app-breadcrumbs';

vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));

function renderBreadcrumbs(
  parentSearch?: (search: Record<string, unknown>) => Record<string, unknown>,
) {
  const root = createRootRoute();
  const route = createRoute({
    getParentRoute: () => root,
    path: 'administration/users/$id/roles',
    staticData: { crumbKey: 'users.roles', crumbParentSearch: parentSearch },
    component: AppBreadcrumbs,
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({
      initialEntries: ['/administration/users/u1/roles?page=4&q=admin'],
    }),
  });
  render(<RouterProvider router={router} />);
}

describe('AppBreadcrumbs parent search', () => {
  it('gives only the last linked nav crumb the search returned by the route', async () => {
    renderBreadcrumbs((search) => ({ page: search.page, q: search.q }));
    expect(await screen.findByRole('link', { name: 'nav.administration.users' })).toHaveAttribute(
      'href',
      '/administration/users?page=4&q=admin',
    );
    expect(screen.getByRole('link', { name: 'home.title' })).toHaveAttribute('href', '/home');
  });
  it('keeps existing breadcrumb links bare when no callback is supplied', async () => {
    renderBreadcrumbs();
    expect(await screen.findByRole('link', { name: 'nav.administration.users' })).toHaveAttribute(
      'href',
      '/administration/users',
    );
  });
});
