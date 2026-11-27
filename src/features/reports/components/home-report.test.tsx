// @vitest-environment jsdom
import type { EmbedDashboardParams } from '@superset-ui/embedded-sdk';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { HomeReport } from '@/features/reports/components/home-report';
import { client } from '@/integrations/axios';
import { homeReportQueryKey } from '@/lib/key-factory';
import { Route as HomeRoute } from '@/routes/(protected)/_protected.home';
import { httpError } from '@/test-utils/http-error';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/lib/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/runtime-config')>()),
  getSupersetUrl: () => 'https://superset.example.org',
}));

vi.mock('@superset-ui/embedded-sdk', () => ({
  embedDashboard: ({ fetchGuestToken }: EmbedDashboardParams) => fetchGuestToken(),
}));

const report = {
  id: 'stock',
  name: 'Stock dashboard',
  type: 'POWERBI',
  url: 'https://bi.example.org/stock',
};
const availableUrl = '/reports/dashboardReports/availableReports';

const page = (content: object[]) => ({
  data: { content, totalElements: content.length, totalPages: 1 },
});

function renderReport() {
  const queryClient = new QueryClient();
  renderPage(<HomeReport userId="admin" username="ada" />, { queryClient });
  return queryClient;
}

beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}));

afterEach(() => {
  cleanup();
  useLoginData.getState().clearLoginData();
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});

it('renders no report while offline and waits for a connection before querying', async () => {
  onlineManager.setOnline(false);
  const response = Promise.withResolvers<ReturnType<typeof page>>();
  const get = vi.spyOn(client, 'get').mockReturnValue(response.promise);
  const queryClient = renderReport();

  expect(get).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByTitle(report.name)).not.toBeInTheDocument();

  act(() => onlineManager.setOnline(true));
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      availableUrl,
      expect.objectContaining({ params: { size: 0, showOnHomePage: true } }),
    ),
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByTitle(report.name)).not.toBeInTheDocument();

  await act(async () => response.resolve(page([])));
  await waitFor(() => expect(queryClient.getQueryData(homeReportQueryKey('admin'))).toBeNull());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});

it('shows an inline error with Retry and refreshes to a replacement report', async () => {
  const user = userEvent.setup();
  const replacement = { ...report, id: 'replacement', name: 'New home dashboard' };
  const discover = vi
    .fn()
    .mockRejectedValueOnce(httpError(403))
    .mockResolvedValueOnce(page([report]))
    .mockResolvedValue(page([replacement]));
  vi.spyOn(client, 'get').mockImplementation(async (url) => {
    if (url === availableUrl) return discover();
    if (url === '/users/admin/permissionStrings') return { data: [] };
    if (url === '/users/admin') return { data: { firstName: 'Ada' } };
    throw new Error(`Unexpected request: ${url}`);
  });
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'admin',
    username: 'ada',
    accessToken: 'token',
  });
  const HomePage = HomeRoute.options.component;
  if (!HomePage) throw new Error('Home has no route component');
  renderPage(<HomePage />, {
    queryClient: new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: false } },
    }),
  });

  expect(await screen.findByRole('alert')).toHaveTextContent('home.load-error');
  await user.click(screen.getByRole('button', { name: 'error.try-again' }));
  expect(await screen.findByTitle(report.name)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'home.refresh' }));
  expect(await screen.findByTitle(replacement.name)).toBeInTheDocument();
  expect(screen.queryByTitle(report.name)).not.toBeInTheDocument();
  expect(discover).toHaveBeenCalledTimes(3);
});

it('keeps a refused embed in the Home panel with Retry', async () => {
  const embedded = {
    ...report,
    type: 'SUPERSET',
    embeddedUuid: '42ef1032-a83a-40e9-9b67-a2c2569c2b66',
  };
  vi.spyOn(client, 'get').mockImplementation(async (url) => {
    if (url === availableUrl) return page([embedded]);
    if (url === '/reports/superset/guest-token') throw httpError(403);
    throw new Error(`Unexpected request: ${url}`);
  });
  renderReport();

  expect(await screen.findByRole('alert')).toHaveTextContent('reports.dashboard.refused-title');
  expect(screen.getByRole('button', { name: 'error.try-again' })).toBeEnabled();
  expect(document.querySelector('a[href="/reports"]')).toBeNull();
});

it('keeps Home open after dismissing Superset sign-in', async () => {
  const user = userEvent.setup();
  const legacy = { ...report, type: 'SUPERSET', url: 'https://superset.example.org/dashboard/1' };
  vi.spyOn(client, 'get').mockImplementation(async (url) => {
    if (url === availableUrl) return page([legacy]);
    if (url === 'https://superset.example.org/oauth-init/openlmis')
      return { data: { isAuthorized: false, state: 'test' } };
    throw new Error(`Unexpected request: ${url}`);
  });
  const router = renderPage(<HomeReport userId="admin" username="ada" />);

  expect(
    await screen.findByRole('dialog', { name: 'reports.dashboard.sign-in-title' }),
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'dialog.cancel' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('reports.dashboard.sign-in-title');
  expect(screen.getByRole('button', { name: 'error.try-again' })).toBeVisible();
  expect(router.state.location.pathname).toBe('/');
});
