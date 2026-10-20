// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { systemNotificationsOptions } from '@/features/home/api/queries';
import { SystemNotifications } from '@/features/home/components/system-notifications';
import type { SystemNotification } from '@/features/home/lib/types';

vi.mock('@/hooks/use-deployment-time-zone', () => ({ useDeploymentTimeZone: () => 'UTC' }));

function show(notifications?: SystemNotification[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  if (notifications) client.setQueryData(systemNotificationsOptions().queryKey, notifications);
  render(
    <QueryClientProvider client={client}>
      <SystemNotifications revision={0} />
    </QueryClientProvider>,
  );
}

const notice: SystemNotification = {
  id: 'notice',
  title: 'Service Update',
  message: 'Maintenance tonight',
  author: { firstName: 'Jane', lastName: 'Doe' },
  createdDate: '2026-10-08T14:35:07Z',
};

describe('SystemNotifications', () => {
  it('hides the action when there are no active notifications', () => {
    show([]);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides uncached server data offline', () => {
    onlineManager.setOnline(false);
    show();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a count and opens the messages with legacy creation details', async () => {
    const user = userEvent.setup();
    show([notice, { id: 'second', title: null, message: 'Another notice' }]);
    const button = screen.getByRole('button', { name: /home.notifications.title/ });
    expect(button).toHaveTextContent('2');
    expect(screen.queryByText('Maintenance tonight')).not.toBeInTheDocument();
    await user.click(button);
    const popup = screen.getByRole('dialog');
    expect(within(popup).getByText('Service Update')).toBeInTheDocument();
    expect(within(popup).getByText('Maintenance tonight')).toBeInTheDocument();
    expect(within(popup).getByText('Another notice')).toBeInTheDocument();
    expect(within(popup).getByText('Jane Doe')).toBeInTheDocument();
    expect(within(popup).getByText('Oct 8, 2026, 2:35:07 PM')).toBeInTheDocument();
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
