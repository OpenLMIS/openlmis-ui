import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import * as mobile from '@/hooks/use-mobile';
import { parsePermissions } from '@/lib/permissions';
import { renderPage } from '@/tests/render-page';

function renderSidebar(rights: string[], { path = '/', defaultOpen = true } = {}) {
  useLoginData.setState({ referenceDataUserId: 'u1', username: 'admin' });
  const queryClient = new QueryClient();
  queryClient.setQueryData(permissionsOptions('u1').queryKey, parsePermissions(rights));
  renderPage(
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
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

  it('keeps both destinations on the collapsed sidebar', async () => {
    renderSidebar(['SYSTEM_SETTINGS_MANAGE'], { defaultOpen: false });

    expect(await screen.findByRole('link', { name: 'nav-user.account' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(screen.getByRole('link', { name: 'nav-user.settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
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
