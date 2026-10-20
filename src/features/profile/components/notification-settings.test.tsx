import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchDigestConfigurations,
  fetchSubscriptions,
  saveSubscriptions,
} from '@/features/profile/api/api';
import { subscriptionsOptions } from '@/features/profile/api/queries';
import { NotificationSettings } from '@/features/profile/components/notification-settings';
import { ProfileWorkspace } from '@/features/profile/components/profile-workspace';
import type { DigestSubscription } from '@/features/profile/lib/types';

vi.mock('@/features/profile/api/api', () => ({
  fetchDigestConfigurations: vi.fn(),
  fetchSubscriptions: vi.fn(),
  saveSubscriptions: vi.fn(),
}));

const sms: DigestSubscription = {
  digestConfiguration: { id: 'd1' },
  preferredChannel: 'SMS',
  useDigest: false,
};

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
  vi.mocked(fetchDigestConfigurations)
    .mockReset()
    .mockResolvedValue([{ id: 'd1', tag: 'requisition-actionRequired' }]);
  vi.mocked(fetchSubscriptions).mockReset().mockResolvedValue([sms]);
  vi.mocked(saveSubscriptions).mockReset().mockResolvedValue();
});

async function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({
    component: () => (
      <ProfileWorkspace username="ada">
        <NotificationSettings hasContactDetails userId="u1" />
      </ProfileWorkspace>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/profile/notifications'] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByText('Requisition - Action Required');
  return { user: userEvent.setup(), queryClient };
}

const digestSwitch = () => screen.getByRole('switch', { name: /use-digest/ });
const channel = () => screen.getByRole('combobox', { name: /profile.notifications.channel/ });

describe('NotificationSettings', () => {
  it('switches a digest to email, the only channel digests go by', async () => {
    const { user } = await renderSettings();
    expect(channel()).toHaveTextContent('profile.notifications.sms');

    await user.click(digestSwitch());

    expect(channel()).toHaveTextContent('profile.notifications.email');
    expect(screen.getByText('profile.notifications.digest-email-only')).toBeInTheDocument();
    expect(screen.queryByText('profile.notifications.digest-hint')).not.toBeInTheDocument();
  });

  it('starts a custom schedule from the simple one it replaces', async () => {
    const { user } = await renderSettings();
    expect(channel()).toHaveAccessibleName(
      'Requisition - Action Required profile.notifications.channel',
    );
    await user.click(digestSwitch());

    await user.click(screen.getByRole('combobox', { name: /profile.notifications.frequency/ }));
    await user.click(await screen.findByRole('option', { name: 'profile.notifications.custom' }));

    expect(screen.getByRole('textbox', { name: /profile.notifications.cron/ })).toHaveValue(
      '0 0 8 * * *',
    );
    expect(
      screen.getByRole('textbox', { name: /profile.notifications.cron/ }),
    ).toHaveAccessibleDescription('profile.notifications.cron-description');
    expect(screen.getByText('profile.notifications.digest-hint')).toBeInTheDocument();
    expect(screen.queryByText('profile.notifications.digest-email-only')).not.toBeInTheDocument();
  });

  it('keeps what was saved on screen when the refresh after a save fails', async () => {
    const { user, queryClient } = await renderSettings();
    await user.click(digestSwitch());
    let refuseRefresh!: (error: Error) => void;
    vi.mocked(fetchSubscriptions).mockReturnValue(
      new Promise((_, reject) => {
        refuseRefresh = reject;
      }),
    );

    await user.click(screen.getByRole('button', { name: 'profile.notifications.save' }));

    await waitFor(() => expect(saveSubscriptions).toHaveBeenCalledOnce());
    await waitFor(() => expect(fetchSubscriptions).toHaveBeenCalledTimes(2));
    await act(async () => refuseRefresh(new Error('offline')));
    await waitFor(() =>
      expect(queryClient.getQueryData(subscriptionsOptions('u1').queryKey)).toEqual([
        {
          digestConfiguration: { id: 'd1' },
          preferredChannel: 'EMAIL',
          useDigest: true,
          cronExpression: '0 0 8 * * *',
        },
      ]),
    );
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(digestSwitch()).toBeChecked();
    expect(screen.getByRole('button', { name: 'profile.notifications.save' })).toBeDisabled();
  });

  it('clears a failed save message when the changes are cancelled', async () => {
    vi.mocked(saveSubscriptions).mockRejectedValue(new Error('refused'));
    const { user } = await renderSettings();
    await user.click(digestSwitch());
    await user.click(screen.getByRole('button', { name: 'profile.notifications.save' }));
    expect(await screen.findByText('profile.notifications.save-error-title')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'profile.cancel' }));

    expect(screen.queryByText('profile.notifications.save-error-title')).not.toBeInTheDocument();
  });

  it('moves to the first field to correct when a save is refused', async () => {
    const { user } = await renderSettings();
    await user.click(digestSwitch());
    await user.click(screen.getByRole('combobox', { name: /profile.notifications.frequency/ }));
    await user.click(await screen.findByRole('option', { name: 'profile.notifications.custom' }));
    const cron = screen.getByRole('textbox', { name: /profile.notifications.cron/ });
    await user.clear(cron);
    await user.type(cron, 'bad');

    await user.click(screen.getByRole('button', { name: 'profile.notifications.save' }));

    await waitFor(() => expect(cron).toHaveFocus());
    expect(saveSubscriptions).not.toHaveBeenCalled();
  });

  it('offers no Save or Cancel when there is nothing to set up', async () => {
    vi.mocked(fetchDigestConfigurations).mockResolvedValue([]);
    vi.mocked(fetchSubscriptions).mockResolvedValue([]);
    const queryClient = new QueryClient();
    const root = createRootRoute({
      component: () => (
        <ProfileWorkspace username="ada">
          <NotificationSettings hasContactDetails userId="u1" />
        </ProfileWorkspace>
      ),
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider
          router={createRouter({ routeTree: root, history: createMemoryHistory() })}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('profile.notifications.empty-title')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'profile.notifications.save' })).toBeNull();
  });

  it('holds the table under its real columns while the settings load', async () => {
    vi.mocked(fetchSubscriptions).mockReturnValue(new Promise(() => {}));
    const root = createRootRoute({
      component: () => <NotificationSettings hasContactDetails userId="u1" />,
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider
          router={createRouter({ routeTree: root, history: createMemoryHistory() })}
        />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('columnheader', { name: 'profile.notifications.schedule' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
