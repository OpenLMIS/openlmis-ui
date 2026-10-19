import { onlineManager, QueryClient } from '@tanstack/react-query';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavUser } from '@/components/nav-user';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import { parsePermissions } from '@/lib/permissions';
import { loadRuntimeConfig } from '@/lib/runtime-config';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/profile/api/api', () => ({ fetchProfile: () => new Promise(() => {}) }));

async function renderMenu(rights: string[], systemSettings = 'true') {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ featureFlags: { SYSTEM_SETTINGS: systemSettings } })),
      ),
  );
  await loadRuntimeConfig();
  useLoginData.setState({ referenceDataUserId: 'u1', username: 'admin' });
  const queryClient = new QueryClient();
  queryClient.setQueryData(permissionsOptions('u1').queryKey, parsePermissions(rights));
  renderPage(<NavUser trigger={<button type="button">Menu</button>} />, { queryClient });
}

afterEach(() => {
  cleanup();
  useLoginData.setState({ referenceDataUserId: null, username: null });
  vi.unstubAllGlobals();
});

describe('NavUser', () => {
  it('offers Settings below Account to someone who may manage system settings', async () => {
    await renderMenu(['SYSTEM_SETTINGS_MANAGE']);

    await userEvent.click(await screen.findByRole('button', { name: 'Menu' }));

    const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
    expect(items).toEqual(['nav-user.account', 'nav-user.settings', 'nav-user.log-out']);
    expect(screen.getByRole('menuitem', { name: 'nav-user.settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('leaves Settings out while the deployment has the Settings flag off', async () => {
    await renderMenu(['SYSTEM_SETTINGS_MANAGE'], 'false');

    await userEvent.click(await screen.findByRole('button', { name: 'Menu' }));

    expect(await screen.findByRole('menuitem', { name: 'nav-user.account' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'nav-user.settings' })).not.toBeInTheDocument();
  });

  it('leaves Settings out for everyone else', async () => {
    await renderMenu(['USERS_MANAGE']);

    await userEvent.click(await screen.findByRole('button', { name: 'Menu' }));

    expect(await screen.findByRole('menuitem', { name: 'nav-user.account' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'nav-user.settings' })).not.toBeInTheDocument();
  });
});

it('opens the offline dialog from Account and returns focus on close', async () => {
  onlineManager.setOnline(false);
  await renderMenu([]);
  await userEvent.click(await screen.findByRole('button', { name: 'Menu' }));
  const account = await screen.findByRole('menuitem', { name: 'nav-user.account' });
  expect(account).not.toHaveAttribute('aria-disabled', 'true');
  expect(account).toHaveAttribute('data-unavailable');
  expect(account).not.toHaveAttribute('disabled');
  expect(account).not.toHaveAttribute('href');
  expect(account).toHaveAccessibleDescription('offline.connection-required');
  await userEvent.click(account);
  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    'offline.navigation-unavailable',
  );
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await waitFor(() => expect(account).toHaveFocus());
});
