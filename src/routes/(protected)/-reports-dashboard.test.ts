import { QueryClient } from '@tanstack/react-query';
import { isNotFound } from '@tanstack/react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { permissionsOptions } from '@/features/auth/api/queries';
import { isForbidden } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchAvailableDashboards, fetchGuestToken } from '@/features/reports/api/api';
import { parsePermissions } from '@/lib/permissions';
import { Route } from '@/routes/(protected)/_protected.reports_.dashboards.$dashboardId';

vi.mock('@/features/reports/api/api', () => ({
  fetchAvailableDashboards: vi.fn(),
  fetchGuestToken: vi.fn(),
}));

afterEach(() => {
  useLoginData.setState({ referenceDataUserId: undefined });
});

async function load(dashboardId: string, grants = ['REPORTS_VIEW']) {
  useLoginData.setState({ referenceDataUserId: 'user' });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(permissionsOptions('user').queryKey, parsePermissions(grants));
  const loader = Route.options.loader;
  if (typeof loader !== 'function') throw new Error('Expected dashboard loader');
  try {
    return await loader({ context: { queryClient }, params: { dashboardId } } as Parameters<
      typeof loader
    >[0]);
  } finally {
    queryClient.clear();
  }
}

it('opens an available dashboard in the native viewer', async () => {
  const report = { id: 'dashboard', name: 'Dashboard' };
  vi.mocked(fetchAvailableDashboards).mockResolvedValue([report]);

  await expect(load('dashboard')).resolves.toEqual({ userId: 'user', report });
  expect(fetchGuestToken).not.toHaveBeenCalled();
});

it('denies users without Reports View before discovering dashboards or asking for a token', async () => {
  const result = await load('dashboard', []).catch((error: unknown) => error);

  expect(isForbidden(result)).toBe(true);
  expect(fetchAvailableDashboards).not.toHaveBeenCalled();
  expect(fetchGuestToken).not.toHaveBeenCalled();
});

it('refuses a dashboard missing from the user available list without asking for a token', async () => {
  vi.mocked(fetchAvailableDashboards).mockResolvedValue([{ id: 'other', name: 'Other' }]);

  const result = load('missing').catch((error: unknown) => error);

  expect(isNotFound(await result)).toBe(true);
  expect(fetchGuestToken).not.toHaveBeenCalled();
});
