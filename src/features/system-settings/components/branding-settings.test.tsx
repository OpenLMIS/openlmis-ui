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
import { PartialSaveError } from '@/features/system-settings/lib/partial-save-error';
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
  const { data } = useSuspenseQuery({ ...appConfigurationOptions(), staleTime: Infinity });
  return data ? <BrandingSettings saved={data} /> : null;
}

function renderBranding(saved = savedConfiguration) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(appConfigurationOptions().queryKey, saved);
  renderPage(
    <SystemSettingsWorkspace>
      <FromCache />
    </SystemSettingsWorkspace>,
    { path: '/settings', queryClient },
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

  it('keeps what a save stored before it failed, and retries only the rest', async () => {
    const stored = {
      ...savedConfiguration,
      version: 4,
      logo: { url: '/api/appConfiguration/logo?v=new', contentType: 'image/png', size: 1 },
    };
    vi.mocked(saveBranding).mockRejectedValueOnce(new PartialSaveError(stored, httpError(500)));
    renderBranding();
    await nameField();

    await userEvent.upload(
      screen.getByLabelText('system-settings.branding.logo-label'),
      new File(['x'], 'logo.png', { type: 'image/png' }),
    );
    await userEvent.type(await nameField(), 'x');
    await userEvent.click(saveButton());

    expect(await screen.findByText('system-settings.save-error-title')).toBeInTheDocument();
    expect(getAppConfiguration().logo?.url).toBe(stored.logo.url);
    expect(fetchAppConfiguration).not.toHaveBeenCalled();

    vi.mocked(saveBranding).mockResolvedValueOnce({ ...stored, version: 5, appName: 'SIGECAx' });
    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(saveBranding).toHaveBeenLastCalledWith(stored, [
        { kind: 'update', appName: 'SIGECAx', showAppName: true },
      ]),
    );
  });

  it('stops the app name at the length the sidebar fits', async () => {
    renderBranding();

    expect(await nameField()).toHaveAttribute('maxlength', '20');
  });

  it('hides the name beside the logo in the sidebar when switched off, and saves it', async () => {
    vi.mocked(saveBranding).mockResolvedValue({ ...savedConfiguration, showAppName: false });
    renderBranding();
    const sidebar = await screen.findByText('system-settings.branding.preview-sidebar');
    const preview = sidebar.closest('figure') as HTMLElement;
    expect(preview).toHaveTextContent('SIGECA');

    await userEvent.click(
      screen.getByRole('switch', { name: 'system-settings.branding.show-name-label' }),
    );

    expect(preview).not.toHaveTextContent('SIGECA');
    await userEvent.click(saveButton());
    await waitFor(() =>
      expect(saveBranding).toHaveBeenCalledWith(savedConfiguration, [
        { kind: 'update', appName: 'SIGECA', showAppName: false },
      ]),
    );
  });

  it('saves an empty name as none, so the built-in name applies', async () => {
    vi.mocked(saveBranding).mockResolvedValue({ ...savedConfiguration, appName: null });
    renderBranding();

    await userEvent.clear(await nameField());
    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(saveBranding).toHaveBeenCalledWith(savedConfiguration, [
        { kind: 'update', appName: null, showAppName: true },
      ]),
    );
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
        { kind: 'update', appName: null, showAppName: true },
      ]),
    );
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('system-settings.branding.reset-done-title', {
      description: 'system-settings.branding.reset-done-description',
    });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(async () => expect(await nameField()).toHaveValue(''));
    expect(await nameField()).toHaveAttribute('placeholder', 'OpenLMIS');
  });

  it('offers no Reset while the built-in branding is in use, even when it was typed in', async () => {
    renderBranding({ ...savedConfiguration, appName: 'OpenLMIS', logo: null });

    expect(
      await screen.findByRole('button', { name: 'system-settings.branding.reset' }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('keeps a picked logo when a Reset fails part way', async () => {
    const withLogo = {
      ...savedConfiguration,
      logo: { url: '/api/appConfiguration/logo?v=old', contentType: 'image/png', size: 1 },
    };
    vi.mocked(saveBranding).mockRejectedValueOnce(
      new PartialSaveError({ ...withLogo, version: 4, logo: null }, httpError(500)),
    );
    renderBranding(withLogo);
    await nameField();
    await userEvent.upload(
      screen.getByLabelText('system-settings.branding.logo-label'),
      new File(['x'], 'new.png', { type: 'image/png' }),
    );
    const preview = () =>
      screen.getByRole('img', { name: 'system-settings.branding.logo-preview' });
    await waitFor(() => expect(preview().getAttribute('src')).toMatch(/^blob:/));
    const picked = preview().getAttribute('src');

    await userEvent.click(screen.getByRole('button', { name: 'system-settings.branding.reset' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'system-settings.branding.reset-confirm' }),
    );

    expect(await screen.findByText('system-settings.save-error-title')).toBeInTheDocument();
    expect(preview()).toHaveAttribute('src', picked);
    expect(saveButton()).toBeEnabled();
  });

  it('keeps showing the saved logo when a picked file is refused', async () => {
    renderBranding();
    await nameField();
    const preview = screen.getByRole('img', { name: 'system-settings.branding.logo-preview' });
    const before = preview.getAttribute('src');

    await userEvent.upload(
      screen.getByLabelText('system-settings.branding.logo-label'),
      new File(['x'], 'logo.gif', { type: 'image/gif' }),
      { applyAccept: false },
    );

    expect(
      await screen.findByText('system-settings.branding.errors.logo-type'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'system-settings.branding.logo-preview' }),
    ).toHaveAttribute('src', before);
  });

  it('moves focus to the field that needs fixing when Save is refused', async () => {
    renderBranding();
    await nameField();
    await userEvent.upload(
      screen.getByLabelText('system-settings.branding.logo-label'),
      new File(['x'], 'logo.gif', { type: 'image/gif' }),
      { applyAccept: false },
    );

    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'system-settings.branding.logo-upload' }),
      ).toHaveFocus(),
    );
    expect(saveBranding).not.toHaveBeenCalled();
  });

  it('saves other changes while a longer saved name is left alone', async () => {
    const long = { ...savedConfiguration, appName: 'Ministry Of Health Supply Portal' };
    vi.mocked(saveBranding).mockResolvedValue({ ...long, showAppName: false });
    renderBranding(long);
    await nameField();

    await userEvent.click(
      screen.getByRole('switch', { name: 'system-settings.branding.show-name-label' }),
    );
    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(saveBranding).toHaveBeenCalledWith(long, [
        { kind: 'update', appName: 'Ministry Of Health Supply Portal', showAppName: false },
      ]),
    );
  });
});
