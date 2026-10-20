import '@/routes/-offline-pages';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar } from '@/components/app-sidebar';
import { DeviceWorkContext } from '@/components/device-work';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import * as mobile from '@/hooks/use-mobile';
import { parsePermissions } from '@/lib/permissions';
import * as serviceWorker from '@/lib/service-worker';
import { renderPage } from '@/tests/render-page';

vi.mock('@/lib/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feature-flags')>();
  return {
    ...actual,
    useFlag: (key: string) => {
      const value = actual.useFlag(key as never);
      return key === 'SYSTEM_SETTINGS' || value;
    },
  };
});

function renderSidebar(rights: string[], { path = '/', defaultOpen = true, pending = 0 } = {}) {
  useLoginData.setState({ referenceDataUserId: 'u1', username: 'admin' });
  const queryClient = new QueryClient();
  queryClient.setQueryData(permissionsOptions('u1').queryKey, parsePermissions(rights));
  renderPage(
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <DeviceWorkContext
          value={{
            hasDeviceEvents: pending > 0,
            pending,
            waiting: 0,
            uncertain: 0,
            refused: 0,
            sending: false,
            retained: false,
            pauses: [],
            countUnsyncedWork: async () => pending,
            refreshOfflineDownload: () => {},
          }}
        >
          <AppSidebar />
        </DeviceWorkContext>
        <SidebarTrigger />
      </SidebarProvider>
    </TooltipProvider>,
    { path, queryClient },
  );
}

afterEach(() => {
  act(() => useLoginData.setState({ referenceDataUserId: null, username: null }));
  vi.restoreAllMocks();
});

describe('AppSidebar account links', () => {
  it('places Account and permitted Settings immediately below Home', async () => {
    renderSidebar(['SYSTEM_SETTINGS_MANAGE']);

    const home = await screen.findByRole('link', { name: 'home.title' });
    const menu = home.closest('ul');
    expect(menu).not.toBeNull();
    expect(Array.from(menu?.querySelectorAll('a') ?? []).map((link) => link.textContent)).toEqual([
      'home.title',
      'nav-user.account',
      'nav-user.settings',
    ]);
    expect(screen.getByRole('link', { name: 'nav-user.account' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(screen.getByRole('link', { name: 'nav-user.settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('offers Account but hides Settings without its right', async () => {
    renderSidebar(['USERS_MANAGE']);

    expect(await screen.findByRole('link', { name: 'nav-user.account' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'nav-user.settings' })).not.toBeInTheDocument();
  });

  it.each([
    ['/profile/roles', 'nav-user.account'],
    ['/settings/theme', 'nav-user.settings'],
  ])('highlights the account link on %s', async (path, label) => {
    renderSidebar(['SYSTEM_SETTINGS_MANAGE'], { path });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('data-active');
    });
    expect(screen.getByRole('link', { name: 'home.title' })).not.toHaveAttribute('data-active');
  });

  it('keeps account destinations and update controls on the collapsed sidebar', async () => {
    vi.spyOn(serviceWorker, 'useUpdateReady').mockReturnValue(true);
    renderSidebar(['SYSTEM_SETTINGS_MANAGE'], { defaultOpen: false });

    expect(await screen.findByRole('link', { name: 'nav-user.account' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(screen.getByRole('link', { name: 'nav-user.settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.getByRole('button', { name: 'sidebar.theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sidebar.change-language' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'update.reload-to-update' })).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('closes the mobile sidebar when Account is opened', async () => {
    vi.spyOn(mobile, 'useIsMobile').mockReturnValue(true);
    renderSidebar(['SYSTEM_SETTINGS_MANAGE']);

    fireEvent.click(await screen.findByRole('button', { name: 'Toggle Sidebar' }));
    expect(await screen.findByRole('link', { name: 'nav-user.settings' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'nav-user.account' }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'nav-user.account' })).not.toBeInTheDocument();
    });
  });
});

describe('offline navigation', () => {
  it('opens the offline dialog from an expanded sidebar item and returns focus', async () => {
    onlineManager.setOnline(false);
    renderSidebar(['STOCK_ADJUST', 'USERS_MANAGE'], { path: '/stock-management/adjustments' });
    const issue = await screen.findByRole('button', { name: 'nav.stock-management.issue' });
    expect(issue).not.toHaveAttribute('aria-disabled', 'true');
    expect(issue).toHaveAttribute('data-unavailable');
    expect(issue).not.toHaveAttribute('disabled');
    expect(issue).not.toHaveAttribute('href');
    expect(issue).toHaveAccessibleDescription('offline.connection-required');
    issue.focus();
    await userEvent.keyboard(' ');
    expect(
      await screen.findByRole('alertdialog', { name: 'offline.navigation-title' }),
    ).toHaveTextContent('offline.navigation-unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
    await waitFor(() => expect(issue).toHaveFocus());
    expect(screen.getByRole('link', { name: 'nav.stock-management.adjustments' })).toHaveAttribute(
      'data-active',
    );
  });

  it('opens the offline dialog from the collapsed rail flyout and returns focus', async () => {
    onlineManager.setOnline(false);
    renderSidebar(['STOCK_ADJUST'], { defaultOpen: false });
    await userEvent.click(await screen.findByRole('button', { name: 'nav.stock-management' }));
    const issue = await screen.findByRole('menuitem', { name: 'nav.stock-management.issue' });
    expect(issue).toHaveAttribute('data-unavailable');
    issue.focus();
    await userEvent.keyboard('{Enter}');
    expect(
      await screen.findByRole('alertdialog', { name: 'offline.navigation-title' }),
    ).toHaveTextContent('offline.navigation-unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
    await waitFor(() => expect(issue).toHaveFocus());
  });
});

it('puts counted Offline Events directly below Home and keeps its link available offline', async () => {
  onlineManager.setOnline(false);
  renderSidebar([], { pending: 4 });
  const events = await screen.findByRole('link', { name: 'offline-events.nav-count' });
  expect(events).toHaveAttribute('href', '/offline-events');
  expect(events).not.toHaveAttribute('aria-disabled', 'true');
  const items = [...(events.closest('ul')?.children ?? [])];
  expect(items[0]).toHaveTextContent('home.title');
  expect(items[1]).toHaveTextContent('nav.offline-events');
  expect(items[1].querySelector('[data-slot=sidebar-menu-badge]')).toHaveTextContent('4');
});
