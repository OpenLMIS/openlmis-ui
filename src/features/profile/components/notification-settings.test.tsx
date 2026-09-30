import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchDigestConfigurations,
  fetchSubscriptions,
  saveSubscriptions,
} from '@/features/profile/api/api';
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
  return userEvent.setup();
}

const digestSwitch = () => screen.getByRole('switch', { name: /use-digest/ });
const channel = () => screen.getByRole('combobox', { name: /profile.notifications.channel/ });

describe('NotificationSettings', () => {
  it('switches a digest to email, the only channel digests go by', async () => {
    const user = await renderSettings();
    expect(channel()).toHaveTextContent('profile.notifications.sms');

    await user.click(digestSwitch());

    expect(channel()).toHaveTextContent('profile.notifications.email');
  });

  it('starts a custom schedule from the simple one it replaces', async () => {
    const user = await renderSettings();
    await user.click(digestSwitch());

    await user.click(screen.getByRole('combobox', { name: /profile.notifications.frequency/ }));
    await user.click(await screen.findByRole('option', { name: 'profile.notifications.custom' }));

    expect(screen.getByRole('textbox', { name: /profile.notifications.cron/ })).toHaveValue(
      '0 0 8 * * *',
    );
  });

  it('keeps what was saved on screen when the refresh after a save fails', async () => {
    const user = await renderSettings();
    await user.click(digestSwitch());
    vi.mocked(fetchSubscriptions).mockRejectedValue(new Error('offline'));

    await user.click(screen.getByRole('button', { name: 'profile.notifications.save' }));

    await waitFor(() => expect(saveSubscriptions).toHaveBeenCalledOnce());
    await waitFor(() => expect(fetchSubscriptions).toHaveBeenCalledTimes(2));
    expect(digestSwitch()).toBeChecked();
    expect(screen.getByRole('button', { name: 'profile.notifications.save' })).toBeDisabled();
  });

  it('clears a failed save message when the changes are cancelled', async () => {
    vi.mocked(saveSubscriptions).mockRejectedValue(new Error('refused'));
    const user = await renderSettings();
    await user.click(digestSwitch());
    await user.click(screen.getByRole('button', { name: 'profile.notifications.save' }));
    expect(await screen.findByText('profile.notifications.save-error-title')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'profile.cancel' }));

    expect(screen.queryByText('profile.notifications.save-error-title')).not.toBeInTheDocument();
  });

  it('names each control after its notification, so a screen reader can tell the rows apart', async () => {
    await renderSettings();

    expect(channel()).toHaveAccessibleName(
      'Requisition - Action Required profile.notifications.channel',
    );
  });

  it('describes a custom schedule by its format and says why digests are email only', async () => {
    const user = await renderSettings();
    await user.click(digestSwitch());
    await user.click(screen.getByRole('combobox', { name: /profile.notifications.frequency/ }));
    await user.click(await screen.findByRole('option', { name: 'profile.notifications.custom' }));

    expect(
      screen.getByRole('textbox', { name: /profile.notifications.cron/ }),
    ).toHaveAccessibleDescription('profile.notifications.cron-description');
    expect(screen.getByText('profile.notifications.digest-hint')).toBeInTheDocument();
    expect(screen.queryByText('profile.notifications.digest-email-only')).not.toBeInTheDocument();
  });

  it('says only that digests are email only while no schedule is custom', async () => {
    const user = await renderSettings();
    await user.click(digestSwitch());

    expect(screen.getByText('profile.notifications.digest-email-only')).toBeInTheDocument();
    expect(screen.queryByText('profile.notifications.digest-hint')).not.toBeInTheDocument();
  });

  it('moves to the first field to correct when a save is refused', async () => {
    const user = await renderSettings();
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
