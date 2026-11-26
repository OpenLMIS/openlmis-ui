// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { systemNotificationsOptions } from '@/features/system-notifications/api/queries';
import { NotificationFormDialog } from '@/features/system-notifications/components/notification-form-dialog';
import { SystemNotifications } from '@/features/system-notifications/components/system-notifications';
import type { SystemNotification } from '@/features/system-notifications/lib/types';
import { client } from '@/integrations/axios';

afterEach(() => {
  cleanup();
  useLoginData.getState().clearLoginData();
  localStorage.clear();
  vi.restoreAllMocks();
});

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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const bellKey = systemNotificationsOptions().queryKey;
  queryClient.setQueryData(bellKey, []);
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'author',
    username: 'ada',
    accessToken: 'token',
  });

  const published: SystemNotification[] = [];
  vi.spyOn(client, 'get').mockImplementation(async (url) => {
    if (url === '/users/author') return { data: { id: 'author', firstName: 'Ada' } };
    if (url === '/localeSettings') return { data: { timeZoneId: 'UTC' } };
    if (url === '/systemNotifications') return { data: { content: published, totalPages: 1 } };
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
  await user.click(
    within(form).getByRole('button', { name: 'system-notifications.admin.add-title' }),
  );
  await waitFor(() => expect(form).not.toBeInTheDocument());

  const bell = screen.getByRole('button', { name: 'system-notifications.count' });
  expect(bell).toHaveTextContent('1');
  await user.click(bell);
  const notices = screen.getByRole('dialog', { name: 'nav.administration.system-notifications' });
  expect(within(notices).getByText('Maintenance')).toBeVisible();
});
