import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { expect, it, vi } from 'vitest';
import { client } from '@/integrations/axios';
import {
  catalogError,
  catalogRecord,
  mockCatalogs,
  remarksUrl,
  renderManageBuq,
  setupManageBuqTests,
  sourcesUrl,
} from '@/test-utils/manage-buq';

setupManageBuqTests();

const first = catalogRecord(1, 'Alternative');
const second = catalogRecord(2, 'Warehouse');
const third = catalogRecord(3, 'Visit');
const source = catalogRecord(4, 'Public funding');
const alternateSource = catalogRecord(5, 'External funding');

it('renders remark rows with Edit and Delete actions', async () => {
  mockCatalogs(() => [first]);

  await renderManageBuq();

  const row = await screen.findByRole('row', { name: /Alternative/ });
  expect(within(row).getByRole('button', { name: 'manage-buq.edit' })).toBeEnabled();
  expect(within(row).getByRole('button', { name: 'manage-buq.delete' })).toBeEnabled();
});

it('restores each tab’s linked page and sort and preserves both across tab switches', async () => {
  const extraSources = Array.from({ length: 99 }, (_, index) =>
    catalogRecord(index + 6, `Supplemental Funding ${index + 1}`),
  );
  const get = mockCatalogs((url) =>
    url === remarksUrl ? [first, second, third] : [alternateSource, ...extraSources, source],
  );
  const user = userEvent.setup();
  const { router } = await renderManageBuq(
    '?tab=sources&remarksPage=2&remarksSize=1&remarksSort=name&remarksDir=desc&sourcesPage=2&sourcesSize=1',
  );

  expect(await screen.findByText(source.name)).toBeVisible();
  expect(get).not.toHaveBeenCalledWith(remarksUrl, expect.anything());
  expect(get.mock.calls.filter(([url]) => url === sourcesUrl)).toEqual(
    [0, 1].map((page) => [
      sourcesUrl,
      {
        params: { page, size: 100 },
        sessionScope: expect.any(Number),
        signal: expect.any(AbortSignal),
      },
    ]),
  );
  await user.click(screen.getByRole('tab', { name: 'manage-buq.tab.remarks' }));
  expect(await screen.findByText(third.name)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Previous Page' }));
  expect(await screen.findByText(second.name)).toBeVisible();
  await user.click(screen.getByRole('tab', { name: 'manage-buq.tab.sources' }));
  expect(await screen.findByText(source.name)).toBeVisible();
  expect(router.state.location.search).toMatchObject({
    tab: 'sources',
    remarksSize: 1,
    remarksSort: 'name',
    remarksDir: 'desc',
    sourcesPage: 2,
    sourcesSize: 1,
  });
  expect(router.state.location.search.remarksPage).toBeUndefined();
  await act(async () => router.history.back());
  expect(await screen.findByText(second.name)).toBeVisible();
});

it('replaces the clamped page after deleting its last row and preserves the other tab', async () => {
  let rows = [first, second];
  mockCatalogs(() => rows);
  const remove = vi.spyOn(client, 'delete').mockImplementation(async () => {
    rows = [first];
    return { status: 204 };
  });
  const user = userEvent.setup();
  const { router } = await renderManageBuq('?remarksPage=2&remarksSize=1&sourcesPage=4');

  await screen.findByText(second.name);
  await user.click(screen.getByRole('button', { name: 'manage-buq.delete' }));
  const popup = await screen.findByRole('alertdialog');
  const dialog = within(popup);
  expect(popup).toHaveAccessibleDescription(/manage-buq.delete.warning/);
  await user.click(dialog.getByRole('button', { name: 'manage-buq.delete' }));

  expect(await screen.findByText(first.name)).toBeVisible();
  expect(router.state.location.search).toEqual({ remarksSize: 1, sourcesPage: 4 });
  expect(router.history.canGoBack()).toBe(false);
  expect(remove).toHaveBeenCalledExactlyOnceWith(`${remarksUrl}/${second.id}`);
});

it.each(['edit', 'delete'])(
  'reads a direct read-only %s target and offers only Close',
  async (action) => {
    const record = { ...first, editable: false };
    const get = mockCatalogs(() => [record]);
    const { router } = await renderManageBuq(`?${action}=${record.id}`);
    const dialog = within(
      await screen.findByRole(action === 'edit' ? 'dialog' : 'alertdialog', {
        name: 'manage-buq.read-only-title',
      }),
    );

    expect(dialog.getByText('manage-buq.read-only-description')).toBeVisible();
    expect(dialog.queryByRole('button', { name: /manage-buq\.(delete|form.save)$/ })).toBeNull();
    expect(get).toHaveBeenCalledWith(`${remarksUrl}/${record.id}`, {
      signal: expect.any(AbortSignal),
    });
    await userEvent.click(dialog.getByRole('button', { name: 'dialog.close' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  },
);

it('reports a missing-remark delete failure, closes the dialog and refreshes the list', async () => {
  let rows = [first, second];
  const get = mockCatalogs(() => rows);
  const report = vi.spyOn(toast, 'error');
  vi.spyOn(client, 'delete').mockImplementation(async () => {
    rows = [second];
    throw catalogError(500);
  });
  const user = userEvent.setup();
  const { router } = await renderManageBuq();
  const row = await screen.findByRole('row', { name: /Alternative/ });
  await user.click(within(row).getByRole('button', { name: 'manage-buq.delete' }));
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'manage-buq.delete',
    }),
  );

  await waitFor(() => expect(screen.queryByText(first.name)).toBeNull());
  await waitFor(() => expect(router.state.location.search).toEqual({}));
  expect(get.mock.calls.filter(([url]) => url === remarksUrl)).toHaveLength(2);
  expect(report).toHaveBeenCalledWith('manage-buq.delete.error-title', {
    description: 'error.description',
  });
});
