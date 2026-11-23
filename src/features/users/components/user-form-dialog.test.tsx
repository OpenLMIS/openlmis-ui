import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { minimalFacilitiesOptions } from '@/features/reference-data/api/queries';
import { systemNotificationsOptions } from '@/features/system-notifications/api/queries';
import { userDetailsOptions } from '@/features/users/api/queries';
import { UserFormDialog } from '@/features/users/components/user-form-dialog';
import { client } from '@/integrations/axios';
import type { UserRecord } from '@/lib/user-types';
import { httpError } from '@/test-utils/http-error';

it('completes an Edit User save while the notification refresh is still pending', async () => {
  const editedUser: UserRecord = {
    id: 'ada-id',
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    active: true,
    roleAssignments: [],
  };
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'admin-id',
    username: 'admin',
    accessToken: 'token',
  });
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  cache.setQueryData(userDetailsOptions(editedUser.id).queryKey, {
    user: editedUser,
    contact: null,
    auth: null,
  });
  cache.setQueryData(minimalFacilitiesOptions().queryKey, []);
  const options = systemNotificationsOptions();
  cache.setQueryData(options.queryKey, []);
  const pending = Promise.withResolvers<{ data: { content: []; totalPages: number } }>();
  const get = vi.spyOn(client, 'get').mockImplementation(async (url) => {
    if (url === '/systemNotifications') return pending.promise;
    if (url === '/users/ada-id') return { data: editedUser };
    if (url === '/users/auth/ada-id' || url === '/userContactDetails/ada-id') {
      return { data: null };
    }
    throw new Error(`Unexpected GET ${url}`);
  });
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: undefined });
  vi.spyOn(client, 'post').mockResolvedValue({ data: undefined });
  const unsubscribe = new QueryObserver(cache, options).subscribe(() => {});
  const onClose = vi.fn();
  const dialog = render(
    <QueryClientProvider client={cache}>
      <UserFormDialog onClose={onClose} onCreated={vi.fn()} target={editedUser.id} />
    </QueryClientProvider>,
  );
  try {
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: /users.form.first-name/ }), 'x');
    await user.click(screen.getByRole('button', { name: 'users.form.save' }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/systemNotifications', expect.anything()),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(put).toHaveBeenCalledWith('/users', expect.objectContaining({ firstName: 'Adax' }));
    expect(cache.getQueryState(options.queryKey)?.fetchStatus).toBe('fetching');
  } finally {
    dialog.unmount();
    unsubscribe();
    await act(async () => pending.resolve({ data: { content: [], totalPages: 0 } }));
    cache.clear();
    useLoginData.getState().clearLoginData();
  }
});

it('shows duplicate username refusals only while they match the current value', async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  cache.setQueryData(minimalFacilitiesOptions().queryKey, []);
  const duplicate = httpError(400, {
    messageKey: 'referenceData.error.user.username.duplicated',
    message: 'Server-language detail',
  });
  const put = vi.spyOn(client, 'put').mockRejectedValueOnce(duplicate);
  const dialog = render(
    <QueryClientProvider client={cache}>
      <UserFormDialog onClose={vi.fn()} onCreated={vi.fn()} target="new" />
    </QueryClientProvider>,
  );
  try {
    const user = userEvent.setup();
    const username = await screen.findByRole('textbox', { name: /users.username/ });
    await user.type(username, 'ada');
    await user.type(screen.getByRole('textbox', { name: /users.form.first-name/ }), 'Ada');
    await user.type(screen.getByRole('textbox', { name: /users.form.last-name/ }), 'Lovelace');
    await user.click(screen.getByRole('button', { name: 'users.form.create' }));

    await screen.findByText('api-error.referenceData.error.user.username.duplicated');
    expect(username).toHaveAccessibleDescription(
      'api-error.referenceData.error.user.username.duplicated',
    );
    expect(screen.queryByText('users.form.save-error-title')).not.toBeInTheDocument();

    await user.type(username, '2');
    expect(username).not.toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.queryByText('api-error.referenceData.error.user.username.duplicated'),
    ).not.toBeInTheDocument();

    const pending = Promise.withResolvers<never>();
    put.mockReturnValueOnce(pending.promise);
    await user.click(screen.getByRole('button', { name: 'users.form.create' }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    await user.type(username, '3');
    await act(async () => pending.reject(duplicate));
    await waitFor(() =>
      expect(cache.getMutationCache().getAll().at(-1)?.state.error).toBe(duplicate),
    );
    expect(username).toHaveValue('ada23');
    expect(username).not.toHaveAttribute('aria-invalid', 'true');
  } finally {
    dialog.unmount();
    put.mockRestore();
    cache.clear();
  }
});
