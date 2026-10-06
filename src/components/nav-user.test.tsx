import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavUser } from '@/components/nav-user';
import { rightsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
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
  queryClient.setQueryData(rightsOptions('u1').queryKey, new Set(rights));
  renderPage(<NavUser trigger={<button type="button">Menu</button>} />, { queryClient });
}

afterEach(() => {
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
