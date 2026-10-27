import '@/routes/-offline-pages';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceWorkContext } from '@/components/device-work';
import { NavUser } from '@/components/nav-user';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import * as leaveGuard from '@/hooks/use-leave-guard';
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
    expect(items).toEqual([
      'nav-user.account',
      'nav-user.settings',
      'legacy.label',
      'nav-user.log-out',
    ]);
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

it.each([
  { rights: [], pending: 0, visible: false },
  { rights: [], pending: 1234, visible: true },
])(
  'offers owned Offline Events with a page-language count in the account menu: %j',
  async ({ rights, pending, visible }) => {
    const user = userEvent.setup();
    const language = createInstance();
    await language.init({ lng: 'fr', resources: { fr: { translation: {} } } });
    useLoginData.setState({ referenceDataUserId: 'u1', username: 'admin' });
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData(permissionsOptions('u1').queryKey, parsePermissions(rights));
    const router = renderPage(
      <I18nextProvider i18n={language}>
        <DeviceWorkContext
          value={{
            hasDeviceEvents: pending > 0,
            pending,
            waiting: pending,
            uncertain: 0,
            refused: 0,
            sending: false,
            retained: false,
            pauses: [],
            countUnsyncedWork: async () => pending,
            refreshOfflineDownload: () => {},
          }}
        >
          <NavUser trigger={<button type="button">Open Account Menu</button>} />
        </DeviceWorkContext>
      </I18nextProvider>,
      { queryClient },
    );
    await user.click(await screen.findByRole('button', { name: 'Open Account Menu' }));
    const menu = within(await screen.findByRole('menu'));
    const event = menu.queryByRole('menuitem', {
      name: pending > 0 ? 'offline-events.nav-count' : 'nav.offline-events',
    });
    if (visible) {
      expect(event).toHaveAttribute('href', '/offline-events');
      expect(event?.textContent).toContain('1\u202f234');
      const items = menu.getAllByRole('menuitem');
      expect(items.indexOf(event as HTMLElement)).toBeGreaterThan(
        items.indexOf(menu.getByRole('menuitem', { name: 'nav-user.account' })),
      );
      expect(items.indexOf(event as HTMLElement)).toBeLessThan(
        items.indexOf(menu.getByRole('menuitem', { name: 'nav-user.log-out' })),
      );
      await user.click(menu.getByRole('menuitem', { name: 'offline-events.nav-count' }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/offline-events'));
    } else expect(event).toBeNull();
  },
);

it('waits for the leave flow before navigating to the legacy home', async () => {
  vi.stubEnv('BASE_URL', '/a/b/');
  let proceed: (() => void) | undefined;
  const leave = vi.spyOn(leaveGuard, 'whenLeaveAllowed').mockImplementationOnce((next) => {
    proceed = next;
  });
  const allowUnload = vi.spyOn(leaveGuard, 'allowUnload').mockImplementationOnce(() => {});
  const assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });
  try {
    await renderMenu([]);
    await userEvent.click(await screen.findByRole('button', { name: 'Menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'legacy.label' }));
    expect(leave).toHaveBeenCalledOnce();
    expect(allowUnload).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    proceed?.();
    expect(allowUnload).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledExactlyOnceWith('/a/');
    expect(allowUnload.mock.invocationCallOrder[0]).toBeLessThan(
      assign.mock.invocationCallOrder[0],
    );
  } finally {
    leave.mockRestore();
    allowUnload.mockRestore();
    vi.unstubAllEnvs();
  }
});
