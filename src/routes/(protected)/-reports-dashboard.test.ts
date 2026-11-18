import { QueryClient } from '@tanstack/react-query';
import { isNotFound } from '@tanstack/react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchAvailableDashboards, fetchGuestToken } from '@/features/reports/api/api';
import { getFlag } from '@/lib/feature-flags';
import { parsePermissions } from '@/lib/permissions';
import { Route } from '@/routes/(protected)/_protected.reports_.dashboards.$dashboardId';

vi.mock('@/features/reports/api/api', () => ({
  fetchAvailableDashboards: vi.fn(),
  fetchGuestToken: vi.fn(),
}));
vi.mock('@/lib/feature-flags', async (original) => ({
  ...(await original<typeof import('@/lib/feature-flags')>()),
  getFlag: vi.fn(),
}));

afterEach(() => {
  useLoginData.setState({ referenceDataUserId: undefined });
});

async function load(dashboardId: string) {
  useLoginData.setState({ referenceDataUserId: 'user' });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(permissionsOptions('user').queryKey, parsePermissions(['REPORTS_VIEW']));
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

it('hands every dashboard to legacy without asking the reporting service while the flag is off', async () => {
  vi.mocked(getFlag).mockReturnValue(false);
  vi.mocked(fetchAvailableDashboards).mockRejectedValue(new Error('Catalog down'));

  await expect(load('unknown')).resolves.toEqual({ userId: 'user', report: null });

  expect(fetchAvailableDashboards).not.toHaveBeenCalled();
  expect(fetchGuestToken).not.toHaveBeenCalled();
});

it('refuses a dashboard missing from the user available list without asking for a token', async () => {
  vi.mocked(getFlag).mockReturnValue(true);
  vi.mocked(fetchAvailableDashboards).mockResolvedValue([{ id: 'other', name: 'Other' }]);

  const result = load('missing').catch((error: unknown) => error);

  expect(isNotFound(await result)).toBe(true);
  expect(fetchGuestToken).not.toHaveBeenCalled();
});
