import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { expect, it, vi } from 'vitest';
import { buqRemarksOptions } from '@/features/reference-data/api/queries';
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

const remark = catalogRecord(1, 'Damaged stock');
const source = catalogRecord(2, 'Public funding');
const sourceUrl = `${sourcesUrl}/${source.id}`;
const nameLabel = /manage-buq\.form\.name/;

it('sends no create request for a blank or whitespace-only name', async () => {
  mockCatalogs(() => []);
  const post = vi.spyOn(client, 'post');
  const user = userEvent.setup();
  await renderManageBuq('?edit=new');
  const popup = await screen.findByRole('dialog');
  const dialog = within(popup);

  const name = dialog.getByRole('textbox', { name: nameLabel });
  const form = name.closest('form');
  if (!form) throw new Error('Expected the name field to have a form');
  fireEvent.submit(form);
  expect(await dialog.findByText('manage-buq.form.name-required')).toBeVisible();
  await user.type(name, '   ');
  await user.click(dialog.getByRole('button', { name: 'manage-buq.form.add' }));
  expect(dialog.getByText('manage-buq.form.name-required')).toBeVisible();
  expect(post).not.toHaveBeenCalled();
});

it('shows the server’s duplicate-name refusal on the Name field', async () => {
  mockCatalogs(() => [remark]);
  vi.spyOn(client, 'post').mockRejectedValue(catalogError(400, 'buq.error.remark.name.duplicated'));
  const user = userEvent.setup();
  await renderManageBuq('?edit=new');
  const dialog = within(await screen.findByRole('dialog'));
  const name = dialog.getByRole('textbox', { name: nameLabel });
  await user.type(name, remark.name);
  await user.click(dialog.getByRole('button', { name: 'manage-buq.form.add' }));

  expect(await dialog.findByText('manage-buq.form.name-taken')).toBeVisible();
  expect(name).toHaveAccessibleDescription('manage-buq.form.name-taken');
});

it('refreshes the rendered table and the forecast lookup after an edit', async () => {
  let record = remark;
  mockCatalogs(() => [record]);
  const put = vi.spyOn(client, 'put').mockImplementation(async (_url, payload) => {
    record = { ...record, ...(payload as Partial<typeof record>) };
    return { data: record };
  });
  const user = userEvent.setup();
  const { queryClient } = await renderManageBuq(`?edit=${record.id}`);
  expect(queryClient.getQueryData(buqRemarksOptions().queryKey)).toEqual([remark]);

  const dialog = within(await screen.findByRole('dialog'));
  const name = await dialog.findByRole('textbox', { name: nameLabel });
  await user.clear(name);
  await user.type(name, '  Updated remark  ');
  await user.click(dialog.getByRole('button', { name: 'manage-buq.form.save' }));

  expect(await screen.findByRole('cell', { name: 'Updated remark' })).toBeVisible();
  expect(queryClient.getQueryData(buqRemarksOptions().queryKey)).toEqual([record]);
  expect(put).toHaveBeenCalledExactlyOnceWith(`${remarksUrl}/${remark.id}`, {
    id: remark.id,
    name: 'Updated remark',
    description: null,
  });
});

it.each([false, true])('checks a source immediately before PUT (missing: %s)', async (missing) => {
  const requests: string[] = [];
  let opened = false;
  mockCatalogs(
    () => (missing && opened ? [] : [source]),
    (url) => {
      expect(url).toBe(sourceUrl);
      requests.push('GET');
      if (missing && opened) throw catalogError(404, 'buq.error.sourceOfFund.notFound');
      opened = true;
      return source;
    },
  );
  const put = vi.spyOn(client, 'put').mockImplementation(async () => {
    requests.push('PUT');
    return { data: source };
  });
  const error = vi.spyOn(toast, 'error');
  const user = userEvent.setup();
  const { router } = await renderManageBuq(`?tab=sources&edit=${source.id}`);
  const dialog = within(await screen.findByRole('dialog'));
  await dialog.findByRole('textbox', { name: nameLabel });
  await user.click(dialog.getByRole('button', { name: 'manage-buq.form.save' }));
  await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'sources' }));

  expect(requests).toEqual(missing ? ['GET', 'GET'] : ['GET', 'GET', 'PUT']);
  if (missing) {
    expect(put).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('manage-buq.not-found-title', {
      description: 'api-error.buq.error.sourceOfFund.notFound',
    });
  }
});

it('keeps the Source dialog independent of a pending Remark save and its late completion', async () => {
  mockCatalogs((url) => (url === remarksUrl ? [remark] : [source]));
  const pending = Promise.withResolvers<{ data: typeof remark }>();
  const post = vi.spyOn(client, 'post').mockReturnValue(pending.promise);
  const user = userEvent.setup();
  const { router, queryClient } = await renderManageBuq('?edit=new');

  const remarkDialog = within(await screen.findByRole('dialog'));
  await user.type(remarkDialog.getByRole('textbox', { name: nameLabel }), 'Remark draft');
  await user.click(remarkDialog.getByRole('button', { name: 'manage-buq.form.add' }));
  await waitFor(() => expect(post).toHaveBeenCalledOnce());

  await act(async () =>
    router.navigate({ to: '/administration/manage-buq', search: { tab: 'sources', edit: 'new' } }),
  );
  const sourceDialog = within(
    await screen.findByRole('dialog', { name: 'manage-buq.form.add-source' }),
  );
  const name = sourceDialog.getByRole('textbox', { name: nameLabel });
  expect(name).toHaveValue('');
  expect(name).toBeEnabled();
  await user.type(name, 'Source draft');

  await act(async () => pending.resolve({ data: remark }));
  await waitFor(() => expect(queryClient.isMutating()).toBe(0));
  expect(name).toHaveValue('Source draft');
  expect(router.state.location.search).toEqual({ tab: 'sources', edit: 'new' });
});
