import { QueryClient } from '@tanstack/react-query';
import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppBreadcrumbs } from '@/components/app-shell/app-breadcrumbs';

import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import { parsePermissions } from '@/lib/permissions';
import { renderPage } from '@/test-utils/render-page';

afterEach(() => {
  act(() => useLoginData.setState({ referenceDataUserId: null }));
});

function renderBreadcrumbs(
  parentSearch?: (search: Record<string, unknown>) => Record<string, unknown>,
  rights = ['USERS_MANAGE', 'REQUISITION_VIEW'],
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  useLoginData.setState({ referenceDataUserId: 'user' });
  queryClient.setQueryData(permissionsOptions('user').queryKey, parsePermissions(rights));
  renderPage(<AppBreadcrumbs />, {
    queryClient,
    path: '/administration/users/u1/roles?page=4&q=admin',
    routeStaticData: {
      '/administration/users': { rights: ['USERS_MANAGE'] },
      '/administration/users/$id/roles': {
        crumbKey: 'users.roles',
        crumbParentSearch: parentSearch,
      },
    },
  });
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
  it('leaves the parent crumb unlinked when the user cannot open its route', async () => {
    renderBreadcrumbs(undefined, ['REQUISITION_VIEW']);
    const breadcrumbs = within(
      await screen.findByRole('navigation', { name: 'breadcrumbs.label' }),
    );
    expect(breadcrumbs.getByText('nav.administration.users')).toBeInTheDocument();
    expect(
      breadcrumbs.queryByRole('link', { name: 'nav.administration.users' }),
    ).not.toBeInTheDocument();
  });
});
