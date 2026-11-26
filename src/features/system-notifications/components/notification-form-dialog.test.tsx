// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { NotificationFormDialog } from '@/features/system-notifications/components/notification-form-dialog';
import { SystemNotifications } from '@/features/system-notifications/components/system-notifications';
import type {
  SavedNotification,
  SystemNotification,
} from '@/features/system-notifications/lib/types';
import { client } from '@/integrations/axios';

const notice: SavedNotification = {
  id: '8b46ed1e-bc42-4af5-9bce-721bb71bb4db',
  author: { id: 'original-author' },
  createdDate: '2026-01-01T12:34:56.123456+01:00',
  active: true,
  title: 'Maintenance',
  message: 'Maintenance tonight',
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
  vi.unstubAllGlobals();
});

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

it.each([null, 'UTC'])(
  'blocks saving when the settings read fails with stored zone %s and no verification',
  async (stored) => {
    if (stored) localStorage.setItem('openlmis-ui.time-zone', stored);
    const get = vi.spyOn(client, 'get').mockImplementation(async (url) => {
      if (url === '/users/admin') return { data: { id: 'admin', firstName: 'Ada' } };
      throw new Error(`Unavailable: ${url}`);
    });
    const post = vi.spyOn(client, 'post');

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <NotificationFormDialog onClose={() => {}} target="new" />
      </QueryClientProvider>,
      { onCaughtError: () => {} },
    );

    const dialog = within(
      await screen.findByRole('dialog', { name: 'system-notifications.admin.add-title' }),
    );
    expect(await dialog.findByText('system-notifications.admin.time-zone-error')).toBeVisible();
    expect(dialog.getByRole('button', { name: 'error.try-again' })).toBeEnabled();
    expect(
      dialog.queryByRole('button', { name: 'system-notifications.admin.add-title' }),
    ).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/localeSettings', expect.anything());
    expect(post).not.toHaveBeenCalled();
  },
);

function NotificationsWithAddDialog() {
  const [target, setTarget] = useState<string | undefined>('new');
  return (
    <>
      <SystemNotifications />
      <NotificationFormDialog onClose={() => setTarget(undefined)} target={target} />
    </>
  );
}

it('refreshes the mounted notification bell when an administrator saves a notice', async () => {
  const user = userEvent.setup();
  const queryClient = makeQueryClient();

  const initial = Promise.withResolvers<{
    data: { content: SystemNotification[]; totalPages: number };
  }>();
  const published: SystemNotification[] = [];
  let bellReads = 0;
  vi.spyOn(client, 'get').mockImplementation(async (url) => {
    if (url === '/users/admin') return { data: { id: 'admin', firstName: 'Ada' } };
    if (url === '/localeSettings') return { data: { timeZoneId: 'UTC' } };
    if (url === '/systemNotifications') {
      bellReads += 1;
      return bellReads === 1 ? initial.promise : { data: { content: published, totalPages: 1 } };
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.spyOn(client, 'post').mockImplementation(async (url, payload) => {
    expect(url).toBe('/systemNotifications');
    const notice = { ...(payload as Omit<SystemNotification, 'id'>), id: 'notice' };
    published.push(notice);
    return { data: notice };
  });

  render(
    <QueryClientProvider client={queryClient}>
      <NotificationsWithAddDialog />
    </QueryClientProvider>,
  );
  const form = await screen.findByRole('dialog', { name: 'system-notifications.admin.add-title' });
  await user.type(
    await within(form).findByRole('textbox', { name: /admin.message/ }),
    'Maintenance',
  );
  expect(bellReads).toBe(1);
  await user.click(
    within(form).getByRole('button', { name: 'system-notifications.admin.add-title' }),
  );
  await waitFor(() => expect(form).not.toBeInTheDocument());

  const bell = await screen.findByRole('button', { name: 'system-notifications.count' });
  await waitFor(() => expect(bell).toHaveTextContent('1'));
  await user.click(bell);
  const notices = screen.getByRole('dialog', { name: 'nav.administration.system-notifications' });
  expect(await within(notices).findByText('Maintenance')).toBeVisible();

  await act(async () => initial.resolve({ data: { content: [], totalPages: 1 } }));
  expect(within(notices).getByText('Maintenance')).toBeVisible();
});

it('keeps the Edit fields usable when the read-only author lookup fails', async () => {
  const authorRead = Promise.withResolvers<never>();
  vi.spyOn(client, 'get').mockImplementation(async (url) => {
    if (url === '/localeSettings') return { data: { timeZoneId: 'UTC' } };
    if (url === `/systemNotifications/${notice.id}`) return { data: notice };
    if (url === '/systemNotifications') return authorRead.promise;
    throw new Error(`Unexpected request: ${url}`);
  });
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <NotificationFormDialog onClose={() => {}} target={notice.id} />
    </QueryClientProvider>,
    { onCaughtError: () => {} },
  );

  const dialog = within(
    await screen.findByRole('dialog', { name: 'system-notifications.admin.edit-title' }),
  );
  const message = await dialog.findByRole('textbox', { name: /admin.message/ });
  expect(message).toBeEnabled();
  await act(async () => authorRead.reject(new Error('Unavailable')));
  expect(await dialog.findByText('system-notifications.admin.author-error')).toBeVisible();
  expect(message).toHaveValue(notice.message);
});

it('locks pending fields and shows each save failure only once', async () => {
  const user = userEvent.setup();
  const refusal = Promise.withResolvers<never>();
  const errorToast = vi.spyOn(toast, 'error');
  vi.spyOn(client, 'get').mockImplementation(async (url) => {
    if (url === '/users/admin') return { data: { id: 'admin', firstName: 'Ada' } };
    if (url === '/localeSettings') return { data: { timeZoneId: 'UTC' } };
    throw new Error(`Unexpected request: ${url}`);
  });
  const post = vi
    .spyOn(client, 'post')
    .mockImplementationOnce(() => refusal.promise)
    .mockRejectedValueOnce(new Error('Unavailable'));
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <NotificationFormDialog onClose={() => {}} target="new" />
    </QueryClientProvider>,
  );

  const dialog = within(
    await screen.findByRole('dialog', { name: 'system-notifications.admin.add-title' }),
  );
  const message = await dialog.findByRole('textbox', { name: /admin.message/ });
  await user.type(message, 'Maintenance');
  for (const bound of ['start', 'expiry']) {
    fireEvent.change(
      dialog.getByLabelText(`system-notifications.admin.${bound}-date`, {
        selector: `#${bound}Date`,
      }),
      {
        target: { value: '28/12/2080' },
      },
    );
    expect(dialog.getByLabelText(/admin\.\w+-time/, { selector: `#${bound}Time` })).toBeEnabled();
  }
  const submit = dialog.getByRole('button', { name: 'system-notifications.admin.add-title' });
  await user.click(submit);
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  for (const field of [
    'message',
    'title',
    'startDate',
    'startTime',
    'expiryDate',
    'expiryTime',
    'active',
  ]) {
    expect(document.getElementById(field)).toBeDisabled();
  }

  await act(async () =>
    refusal.reject({
      isAxiosError: true,
      response: {
        status: 400,
        data: { messageKey: 'referenceData.error.systemNotification.message.required' },
      },
    }),
  );
  expect(await dialog.findByText('system-notifications.admin.message-required')).toBeVisible();
  expect(dialog.queryByText('system-notifications.admin.create-error')).not.toBeInTheDocument();
  expect(errorToast).not.toHaveBeenCalled();

  await user.type(message, ' tonight');
  await user.click(submit);
  expect(await dialog.findByRole('alert')).toHaveTextContent(
    'system-notifications.admin.create-error',
  );
  expect(errorToast).not.toHaveBeenCalled();
  expect(post).toHaveBeenLastCalledWith(
    '/systemNotifications',
    expect.objectContaining({ message: 'Maintenance tonight' }),
  );
});
