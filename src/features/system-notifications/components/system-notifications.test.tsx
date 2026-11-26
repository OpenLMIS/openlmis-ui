// @vitest-environment jsdom
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { systemNotificationsOptions } from '@/features/system-notifications/api/queries';
import { SystemNotifications } from '@/features/system-notifications/components/system-notifications';
import type { SystemNotification } from '@/features/system-notifications/lib/types';
import { client } from '@/integrations/axios';

function show(notifications?: SystemNotification[]) {
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false, networkMode: 'always' } },
  });
  const key = systemNotificationsOptions().queryKey;
  if (notifications) cache.setQueryData(key, notifications);
  render(
    <QueryClientProvider client={cache}>
      <SystemNotifications />
    </QueryClientProvider>,
  );
  return cache;
}

const get = vi.fn<typeof client.get>();

beforeEach(() => {
  vi.spyOn(client, 'get').mockImplementation(get);
  localStorage.clear();
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'u1',
    username: 'ada',
    accessToken: 'token',
  });
  get
    .mockReset()
    .mockImplementation(async (url) =>
      url === '/localeSettings'
        ? { data: { timeZoneId: 'UTC' } }
        : { data: { content: [notice], totalPages: 1 } },
    );
});

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  useLoginData.getState().clearLoginData();
});

const notice: SystemNotification = {
  active: true,
  id: 'notice',
  title: 'Service Update',
  message: 'Maintenance tonight',
  author: { firstName: 'Jane', lastName: 'Doe' },
  createdDate: '2026-10-08T14:35:07Z',
};

describe('SystemNotifications', () => {
  it('shows a count and opens the messages with legacy creation details', async () => {
    const user = userEvent.setup();
    show([notice, { id: 'second', title: null, active: true, message: 'Another notice' }]);
    const button = screen.getByRole('button', { name: 'system-notifications.count' });
    expect(button).toHaveTextContent('2');
    expect(screen.queryByText('Maintenance tonight')).not.toBeInTheDocument();
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    const popup = screen.getByRole('dialog', { name: 'nav.administration.system-notifications' });
    expect(within(popup).getByText('Service Update')).toBeInTheDocument();
    expect(within(popup).getByText('Maintenance tonight')).toBeInTheDocument();
    expect(within(popup).getByText('Another notice')).toBeInTheDocument();
    expect(within(popup).getByText('Jane Doe')).toBeInTheDocument();
    expect(within(popup).getByText('Oct 8, 2026, 2:35 PM')).toBeInTheDocument();
    const list = within(popup).getByRole('region', {
      name: 'nav.administration.system-notifications',
    });
    await waitFor(() => expect(list).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(button).toHaveFocus());
  });

  it('keeps the bell interactive while loading and recovers from a failed first read', async () => {
    const read = Promise.withResolvers<never>();
    get.mockReturnValueOnce(read.promise);
    show();
    const button = screen.getByRole('button', { name: 'nav.administration.system-notifications' });
    expect(button).not.toHaveTextContent(/\d/);
    await userEvent.click(button);
    expect(screen.getByText('system-notifications.loading')).toBeInTheDocument();
    await act(async () => read.reject(new Error('Unavailable')));
    expect(await screen.findByText('system-notifications.error')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));
    expect(await screen.findByText('Maintenance tonight')).toBeInTheDocument();
    expect(button).toHaveAccessibleName('system-notifications.count');
  });

  it.each([true, false])(
    'keeps stale cached notices offline (empty: %s) and refreshes on reconnect',
    async (empty) => {
      const cached = empty ? [] : [notice];
      const updated = { ...notice, id: 'updated', message: 'Maintenance complete' };
      get.mockResolvedValue({ data: { content: [updated], totalPages: 1 } });
      const { queryKey } = systemNotificationsOptions();
      const cache = show(cached);
      act(() => {
        onlineManager.setOnline(false);
        cache.setQueryData(queryKey, cached, { updatedAt: 1 });
      });
      const button = screen.getByRole('button', {
        name: empty ? 'system-notifications.empty' : 'system-notifications.count',
      });
      if (empty) expect(button).not.toHaveTextContent(/\d/);
      await userEvent.click(button);
      expect(screen.getByRole('dialog')).toHaveTextContent(
        empty ? 'system-notifications.empty' : 'Maintenance tonight',
      );
      await act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
      await act(async () => {
        await cache.getQueryCache().find({ queryKey })?.promise;
      });
      expect(get).not.toHaveBeenCalled();
      act(() => onlineManager.setOnline(true));
      await waitFor(() =>
        expect(get).toHaveBeenCalledWith('/systemNotifications', expect.anything()),
      );
      expect(await screen.findByText('Maintenance complete')).toBeInTheDocument();
      expect(screen.queryByText('Maintenance tonight')).not.toBeInTheDocument();
    },
  );

  it('keeps the previous count and list when a stale focus refetch fails', async () => {
    const cache = show([notice]);
    const key = systemNotificationsOptions().queryKey;
    cache.setQueryData(key, [notice], { updatedAt: 1 });
    get.mockRejectedValueOnce(new Error('Unavailable'));
    act(() => focusManager.setFocused(false));
    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(cache.getQueryState(key)?.status).toBe('error'));
    await userEvent.click(screen.getByRole('button', { name: 'system-notifications.count' }));
    expect(screen.getByText('Maintenance tonight')).toBeInTheDocument();
    expect(screen.queryByText('system-notifications.error')).not.toBeInTheDocument();
  });

  it('renders basic HTML and safe links while stripping executable markup and unsafe URLs', async () => {
    const user = userEvent.setup();
    show([
      {
        ...notice,
        message:
          '<p onclick="alert(1)"><strong>Read</strong> <a href="https://test.openlmis.org/v2/" target="_blank" onclick="alert(1)">Details</a></p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">Unsafe</a><a href="/api/logout">Relative</a><a href="mailto:help@example.com">Email</a>',
      },
    ]);
    await user.click(screen.getByRole('button'));
    const popup = screen.getByRole('dialog');
    const link = within(popup).getByRole('link', { name: 'Details' });
    expect(link).toHaveAttribute('href', 'https://test.openlmis.org/v2/');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).not.toHaveAttribute('onclick');
    expect(within(popup).getByText('Read').tagName).toBe('STRONG');
    expect(popup.querySelector('script, img, [onclick], [onerror]')).toBeNull();
    expect(within(popup).queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument();
    expect(within(popup).queryByRole('link', { name: 'Relative' })).not.toBeInTheDocument();
    expect(within(popup).getByRole('link', { name: 'Email' })).toHaveAttribute(
      'href',
      'mailto:help@example.com',
    );
  });
});
