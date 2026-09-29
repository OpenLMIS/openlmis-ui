import { QueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAppConfiguration, saveBranding } from '@/features/system-settings/api/api';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { BrandingSettings } from '@/features/system-settings/components/branding-settings';
import { savedConfiguration } from '@/features/system-settings/components/settings-fixtures';
import { SystemSettingsWorkspace } from '@/features/system-settings/components/system-settings-workspace';
import {
  DEFAULT_APP_CONFIGURATION,
  getAppConfiguration,
  setAppConfiguration,
} from '@/lib/app-configuration';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/system-settings/api/api', () => ({
  fetchAppConfiguration: vi.fn(),
  saveBranding: vi.fn(),
  updateAppConfiguration: vi.fn(),
}));

function FromCache() {
  const { data } = useSuspenseQuery(appConfigurationOptions());
  return data ? <BrandingSettings saved={data} /> : null;
}

function renderBranding(saved = savedConfiguration) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(appConfigurationOptions().queryKey, saved);
  renderPage(
    <SystemSettingsWorkspace>
      <FromCache />
    </SystemSettingsWorkspace>,
    { path: '/administration/system-settings', queryClient },
  );
}

const nameField = () =>
  screen.findByRole('textbox', { name: /system-settings.branding.name-label/ });
const saveButton = () => screen.getByRole('button', { name: 'system-settings.save' });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(toast, 'success').mockImplementation(() => '');
  setAppConfiguration(DEFAULT_APP_CONFIGURATION);
});

describe('BrandingSettings', () => {
  it('keeps the draft and blocks Save after someone else saved, until Reload', async () => {
    vi.mocked(saveBranding).mockRejectedValue(httpError(409));
    vi.mocked(fetchAppConfiguration).mockResolvedValue({
      ...savedConfiguration,
      version: 4,
      appName: 'Someone Else',
    });
    renderBranding();

    await userEvent.clear(await nameField());
    await userEvent.type(await nameField(), 'Mine');
    await userEvent.click(saveButton());

    expect(await screen.findByText('system-settings.conflict-title')).toBeInTheDocument();
    expect(await nameField()).toHaveValue('Mine');
    expect(saveButton()).toBeDisabled();
    expect(fetchAppConfiguration).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'system-settings.conflict-reload' }));

    await waitFor(async () => expect(await nameField()).toHaveValue('Someone Else'));
    expect(screen.queryByText('system-settings.conflict-title')).not.toBeInTheDocument();
  });

  it('shows what the server holds after a save that failed part way', async () => {
    vi.mocked(saveBranding).mockRejectedValue(httpError(500));
    const stored = {
      ...savedConfiguration,
      version: 4,
      logo: { url: '/api/appConfiguration/logo?v=new', contentType: 'image/png', size: 1 },
    };
    vi.mocked(fetchAppConfiguration).mockResolvedValue(stored);
    renderBranding();

    await userEvent.type(await nameField(), 'x');
    await userEvent.click(saveButton());

    await waitFor(() => expect(getAppConfiguration().logo?.url).toBe(stored.logo.url));
    expect(await screen.findByText('system-settings.save-error-title')).toBeInTheDocument();
  });

  it('offers Remove only when there is a logo to remove', async () => {
    renderBranding();
    await nameField();
    expect(
      screen.queryByRole('button', { name: 'system-settings.branding.logo-remove' }),
    ).not.toBeInTheDocument();
  });

  it('asks before resetting, then restores the built-in branding', async () => {
    vi.mocked(saveBranding).mockResolvedValue({ ...savedConfiguration, version: 4, appName: null });
    renderBranding();

    await userEvent.click(
      await screen.findByRole('button', { name: 'system-settings.branding.reset' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'system-settings.branding.reset-confirm' }),
    );

    await waitFor(() =>
      expect(saveBranding).toHaveBeenCalledWith(savedConfiguration, [
        { kind: 'update', appName: null },
      ]),
    );
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('system-settings.branding.reset-done-title', {
      description: 'system-settings.branding.reset-done-description',
    });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(async () => expect(await nameField()).toHaveValue('OpenLMIS'));
  });
});
