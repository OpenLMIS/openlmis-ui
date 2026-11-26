// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { CategoryFormDialog } from '@/features/report-categories/components/category-form-dialog';
import { client } from '@/integrations/axios';
import { queryKeys } from '@/lib/key-factory';

const listUrl = '/reports/reportCategories';
const category = { id: '8b46ed1e-bc42-4af5-9bce-721bb71bb4db', name: 'Stock' };

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

function renderCategoryDialog(target = 'new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const reportsLookup = queryKeys.reportCategories.list({ userId: 'admin' });
  const dashboards = queryKeys.dashboardReports.list({ userId: 'admin', showOnHomePage: false });
  const templates = queryKeys.reportTemplates.list({ userId: 'admin', module: 'common' });
  queryClient.setQueryData(reportsLookup, [category]);
  queryClient.setQueryData(dashboards, [{ id: 'dashboard', category }]);
  queryClient.setQueryData(templates, [{ id: 'template', category }]);
  const onClose = vi.fn();
  const dialog = (target: string | undefined) => (
    <QueryClientProvider client={queryClient}>
      <CategoryFormDialog onClose={onClose} target={target} />
    </QueryClientProvider>
  );
  const { rerender } = render(dialog(target));
  return {
    listInvalidations: () =>
      [reportsLookup, dashboards, templates].map(
        (key) => queryClient.getQueryState(key)?.isInvalidated,
      ),
    onClose,
    setTarget: (target: string | undefined) => rerender(dialog(target)),
  };
}

it('refuses a whitespace-only name before making a request', async () => {
  const user = userEvent.setup();
  const post = vi.spyOn(client, 'post').mockResolvedValue({ data: category });
  renderCategoryDialog();

  const dialog = within(
    await screen.findByRole('dialog', { name: 'report-categories.form.add-title' }),
  );
  await user.type(dialog.getByRole('textbox', { name: /report-categories.name/ }), '   ');
  await user.click(dialog.getByRole('button', { name: 'report-categories.form.add' }));

  expect(await dialog.findByText('report-categories.form.name-required')).toBeVisible();
  expect(post).not.toHaveBeenCalled();
});

it('puts a duplicate-name refusal on the Name field', async () => {
  const user = userEvent.setup();
  vi.spyOn(client, 'post').mockRejectedValue({
    isAxiosError: true,
    response: {
      status: 400,
      data: { messageKey: 'report.error.reportCategory.name.duplicated' },
    },
  });
  const { onClose } = renderCategoryDialog();

  const dialog = within(
    await screen.findByRole('dialog', { name: 'report-categories.form.add-title' }),
  );
  const name = dialog.getByRole('textbox', { name: /report-categories.name/ });
  await user.type(name, category.name);
  await user.click(dialog.getByRole('button', { name: 'report-categories.form.add' }));

  expect(await dialog.findByText('report-categories.form.name-taken')).toBeVisible();
  expect(name).toHaveAccessibleDescription('report-categories.form.name-taken');
  expect(onClose).not.toHaveBeenCalled();
});

it('refreshes the Reports category lookup and embedded names after a rename', async () => {
  const user = userEvent.setup();
  const name = 'Warehouse';
  const detailUrl = `${listUrl}/${category.id}`;
  vi.spyOn(client, 'get').mockImplementation(async (url) => {
    if (url === detailUrl) return { data: category };
    throw new Error(`Unexpected request: ${url}`);
  });
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: { ...category, name } });
  const { listInvalidations, onClose } = renderCategoryDialog(category.id);

  const dialog = within(
    await screen.findByRole('dialog', { name: 'report-categories.form.edit-title' }),
  );
  const input = await dialog.findByRole('textbox', { name: /report-categories.name/ });
  expect(input).toHaveValue(category.name);
  expect(listInvalidations()).toEqual([false, false, false]);
  await user.clear(input);
  await user.type(input, `  ${name}  `);
  await user.click(dialog.getByRole('button', { name: 'report-categories.form.save' }));

  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(put).toHaveBeenCalledWith(detailUrl, { id: category.id, name });
  expect(listInvalidations()).toEqual([true, true, true]);
});

it('locks the reopened Edit form until the previous rename finishes', async () => {
  const user = userEvent.setup();
  vi.spyOn(client, 'get').mockResolvedValue({ data: category });
  const request = Promise.withResolvers<{ data: typeof category }>();
  const put = vi.spyOn(client, 'put').mockReturnValue(request.promise);
  const { setTarget } = renderCategoryDialog(category.id);

  const input = () => screen.findByRole('textbox', { name: /report-categories.name/ });
  const save = () => screen.getByRole('button', { name: 'report-categories.form.save' });
  await user.type(await input(), ' renamed');
  await user.click(save());
  await waitFor(() => expect(put).toHaveBeenCalledOnce());

  setTarget(undefined);
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument(),
  );
  setTarget(category.id);

  expect(await input()).toBeDisabled();
  expect(save()).toHaveAttribute('aria-disabled', 'true');
  request.resolve({ data: { ...category, name: 'Stock renamed' } });
  const reopenedInput = await input();
  await waitFor(() => expect(reopenedInput).toBeEnabled());
  expect(save()).not.toHaveAttribute('aria-disabled', 'true');
  expect(put).toHaveBeenCalledOnce();
});
