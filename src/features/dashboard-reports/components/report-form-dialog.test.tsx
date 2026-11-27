// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { dashboardReportsAdminOptions } from '@/features/dashboard-reports/api/queries';
import { ReportFormDialog } from '@/features/dashboard-reports/components/report-form-dialog';
import type { ManagedDashboardReport } from '@/features/dashboard-reports/lib/types';
import { reportCategoriesOptions } from '@/features/reference-data/api/queries';
import { client } from '@/integrations/axios';
import { queryKeys } from '@/lib/key-factory';

const url = '/reports/dashboardReports';
const category = { id: 'c1', name: 'Stock Reports' };
const stock: ManagedDashboardReport = {
  id: '8b46ed1e-bc42-4af5-9bce-721bb71bb4db',
  name: 'Stock',
  type: 'POWERBI',
  category,
  url: 'https://bi.example.org/stock',
  enabled: true,
  showOnHomePage: false,
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
});

function renderForm(
  target: string,
  freshList: ManagedDashboardReport[] = [],
  cachedList = [stock],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const catalog = queryKeys.dashboardReports.list({ userId: 'admin', showOnHomePage: false });
  const home = queryKeys.dashboardReports.list({ userId: 'admin', showOnHomePage: true });
  queryClient.setQueryData(dashboardReportsAdminOptions().queryKey, cachedList);
  queryClient.setQueryData(reportCategoriesOptions('admin').queryKey, [category]);
  queryClient.setQueryData(catalog, [stock]);
  queryClient.setQueryData(home, stock);
  const get = vi.spyOn(client, 'get').mockImplementation(async (path) => {
    if (path === `${url}/${stock.id}`) return { data: { ...stock, name: 'Fresh stock' } };
    if (path === url) return { data: { content: freshList } };
    throw new Error(`Unexpected request: ${path}`);
  });
  const onClose = vi.fn();
  const dialog = (target: string | undefined) => (
    <QueryClientProvider client={queryClient}>
      <ReportFormDialog onClose={onClose} target={target} userId="admin" />
    </QueryClientProvider>
  );
  const { rerender } = render(dialog(target));
  return {
    get,
    onClose,
    queryClient,
    catalog,
    home,
    setTarget: (target?: string) => rerender(dialog(target)),
  };
}

it('opens with fresh Edit values and invalidates the catalog and Home after saving', async () => {
  const user = userEvent.setup();
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: stock });
  const { onClose, queryClient, catalog, home } = renderForm(stock.id);
  const input = await screen.findByRole('textbox', { name: /dashboard-reports.name/ });
  expect(input).toHaveValue('Fresh stock');
  await user.type(input, ' dashboard');
  await user.click(screen.getByRole('button', { name: 'dashboard-reports.form.save' }));

  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(put).toHaveBeenCalledWith(
    `${url}/${stock.id}`,
    expect.objectContaining({
      id: stock.id,
      name: 'Fresh stock dashboard',
    }),
  );
  expect(queryClient.getQueryState(catalog)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(home)?.isInvalidated).toBe(true);
});

it('puts a POST duplicate refusal on Name and keeps the Add dialog open', async () => {
  const user = userEvent.setup();
  const post = vi.spyOn(client, 'post').mockRejectedValue({
    isAxiosError: true,
    response: {
      status: 400,
      data: { messageKey: 'report.error.dashboardReport.name.duplicated' },
    },
  });
  const { onClose } = renderForm('new');
  const name = await screen.findByRole('textbox', { name: /dashboard-reports.name/ });
  await user.type(name, 'New stock');
  await user.click(screen.getByRole('combobox', { name: /dashboard-reports.category/ }));
  await user.click(await screen.findByRole('option', { name: category.name }));
  await user.click(screen.getByRole('combobox', { name: /dashboard-reports.type/ }));
  await user.click(await screen.findByRole('option', { name: 'dashboard-reports.type.powerbi' }));
  await user.type(
    screen.getByRole('textbox', { name: /dashboard-reports.form.url/ }),
    stock.url ?? '',
  );
  await user.click(screen.getByRole('button', { name: 'dashboard-reports.form.add' }));

  expect(await screen.findByText('dashboard-reports.form.name-taken')).toBeVisible();
  expect(name).toHaveAccessibleDescription('dashboard-reports.form.name-taken');
  expect(post).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
});

it('checks the current Home holder, then sends one write only after confirmation', async () => {
  const user = userEvent.setup();
  const holder = { ...stock, id: 'other', name: 'Current report', showOnHomePage: true };
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: stock });
  const { get, onClose } = renderForm(stock.id, [holder]);
  await user.click(await screen.findByRole('switch', { name: 'dashboard-reports.home' }));
  const submit = () =>
    user.click(screen.getByRole('button', { name: 'dashboard-reports.form.save' }));
  await submit();
  const dialog = within(await screen.findByRole('alertdialog'));
  expect(get).toHaveBeenCalledWith(url, expect.anything());
  expect(put).not.toHaveBeenCalled();
  await user.click(dialog.getByRole('button', { name: 'dialog.cancel' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(put).not.toHaveBeenCalled();

  await submit();
  const confirmation = within(await screen.findByRole('alertdialog'));
  await user.click(
    confirmation.getByRole('button', { name: 'dashboard-reports.home-confirm.action' }),
  );
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(put).toHaveBeenCalledExactlyOnceWith(
    `${url}/${stock.id}`,
    expect.objectContaining({
      name: 'Fresh stock',
      showOnHomePage: true,
    }),
  );
});

it('saves with no confirmation when the fresh list has no Home holder', async () => {
  const user = userEvent.setup();
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: stock });
  renderForm(stock.id, [stock], [{ ...stock, id: 'old', showOnHomePage: true }]);
  await user.click(await screen.findByRole('switch', { name: 'dashboard-reports.home' }));
  await user.click(screen.getByRole('button', { name: 'dashboard-reports.form.save' }));

  await waitFor(() => expect(put).toHaveBeenCalledOnce());
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

it('locks a reopened Edit until it rereads the result of the pending save', async () => {
  const user = userEvent.setup();
  const request = Promise.withResolvers<{ data: ManagedDashboardReport }>();
  const reread = Promise.withResolvers<{ data: ManagedDashboardReport }>();
  const put = vi.spyOn(client, 'put').mockReturnValue(request.promise);
  const { get, setTarget } = renderForm(stock.id);
  get
    .mockResolvedValueOnce({ data: stock })
    .mockResolvedValueOnce({ data: stock })
    .mockReturnValueOnce(reread.promise);
  const name = () => screen.findByRole('textbox', { name: /dashboard-reports.name/ });
  const save = () => screen.getByRole('button', { name: 'dashboard-reports.form.save' });
  await user.type(await name(), ' updated');
  await user.click(save());
  await waitFor(() => expect(put).toHaveBeenCalledOnce());
  setTarget(undefined);
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument(),
  );
  setTarget(stock.id);
  expect(await name()).toBeDisabled();

  request.resolve({ data: { ...stock, name: 'Stock updated' } });
  await waitFor(() =>
    expect(get.mock.calls.filter(([path]) => path === `${url}/${stock.id}`)).toHaveLength(3),
  );
  reread.resolve({ data: { ...stock, name: 'Stock updated' } });

  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: /dashboard-reports.name/ })).toHaveValue(
      'Stock updated',
    ),
  );
  expect(await name()).toBeEnabled();
  expect(put).toHaveBeenCalledOnce();
});

it('keeps the draft and skips the write when checking the Home holder fails', async () => {
  const user = userEvent.setup();
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: stock });
  const { get } = renderForm(stock.id);
  await user.click(await screen.findByRole('switch', { name: 'dashboard-reports.home' }));
  const name = screen.getByRole('textbox', { name: /dashboard-reports.name/ });
  await user.type(name, ' updated');
  get.mockRejectedValueOnce(new Error('Could not load reports'));
  await user.click(screen.getByRole('button', { name: 'dashboard-reports.form.save' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'dashboard-reports.form.save-error-title',
  );
  expect(name).toHaveValue('Fresh stock updated');
  expect(screen.getByRole('switch', { name: 'dashboard-reports.home' })).toBeChecked();
  expect(put).not.toHaveBeenCalled();
});
