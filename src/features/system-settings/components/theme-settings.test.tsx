import { QueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAppConfiguration, updateAppConfiguration } from '@/features/system-settings/api/api';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { savedConfiguration } from '@/features/system-settings/components/settings-fixtures';
import { SystemSettingsWorkspace } from '@/features/system-settings/components/system-settings-workspace';
import { ThemeSettings } from '@/features/system-settings/components/theme-settings';
import { httpError, networkError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/system-settings/api/api', () => ({
  fetchAppConfiguration: vi.fn(),
  updateAppConfiguration: vi.fn(),
}));

function FromCache() {
  const { data } = useSuspenseQuery(appConfigurationOptions());
  return data ? <ThemeSettings saved={data} /> : null;
}

function renderTheme() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(appConfigurationOptions().queryKey, savedConfiguration);
  renderPage(
    <SystemSettingsWorkspace>
      <FromCache />
    </SystemSettingsWorkspace>,
    { path: '/administration/system-settings/theme', queryClient },
  );
  return queryClient;
}

const preset = (name: string) =>
  screen.findByRole('radio', { name: new RegExp(`system-settings.theme.preset.${name}`) });
const saveButton = () => screen.getByRole('button', { name: 'system-settings.save' });
const newer = {
  ...savedConfiguration,
  version: 4,
  theme: { preset: 'purple', defaultAppearance: 'dark' as const },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(toast, 'success').mockImplementation(() => '');
});

describe('ThemeSettings', () => {
  it('saves the chosen preset and appearance', async () => {
    vi.mocked(updateAppConfiguration).mockResolvedValue({
      ...savedConfiguration,
      version: 4,
      theme: { preset: 'green', defaultAppearance: 'light' },
    });
    renderTheme();

    await userEvent.click(
      await screen.findByRole('radio', { name: /system-settings.theme.preset.green/ }),
    );
    await userEvent.click(
      screen.getByRole('radio', { name: /system-settings.theme.appearance.light/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'system-settings.save' }));

    await waitFor(() =>
      expect(updateAppConfiguration).toHaveBeenCalledWith(savedConfiguration, {
        theme: { preset: 'green', defaultAppearance: 'light' },
      }),
    );
  });

  it('blocks Save after someone else saved, until Reload', async () => {
    vi.mocked(updateAppConfiguration).mockRejectedValue(httpError(409));
    renderTheme();

    await userEvent.click(
      await screen.findByRole('radio', { name: /system-settings.theme.preset.green/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'system-settings.save' }));

    expect(await screen.findByText('system-settings.conflict-title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'system-settings.save' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /system-settings.theme.preset.green/ })).toBeChecked();
  });

  it('saves a draft against the version it started from, even after a refetch', async () => {
    vi.mocked(updateAppConfiguration).mockRejectedValue(httpError(409));
    const queryClient = renderTheme();

    await userEvent.click(await preset('green'));
    act(() => queryClient.setQueryData(appConfigurationOptions().queryKey, newer));
    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(updateAppConfiguration).toHaveBeenCalledWith(savedConfiguration, {
        theme: { preset: 'green', defaultAppearance: 'dark' },
      }),
    );
    expect(await screen.findByText('system-settings.conflict-title')).toBeInTheDocument();
  });

  it('follows a refetch while nothing is changed', async () => {
    const queryClient = renderTheme();
    await preset('teal');

    act(() => queryClient.setQueryData(appConfigurationOptions().queryKey, newer));

    expect(await preset('purple')).toBeChecked();
    expect(saveButton()).toBeDisabled();
  });

  it('resets to the defaults after confirming, and keeps focus on Reset', async () => {
    vi.mocked(updateAppConfiguration).mockResolvedValue({
      ...savedConfiguration,
      version: 4,
      theme: { preset: null, defaultAppearance: null },
    });
    renderTheme();
    const reset = await screen.findByRole('button', { name: 'system-settings.theme.reset' });

    await userEvent.click(reset);
    await userEvent.click(
      await screen.findByRole('button', { name: 'system-settings.theme.reset-confirm' }),
    );

    await waitFor(() =>
      expect(updateAppConfiguration).toHaveBeenCalledWith(savedConfiguration, {
        theme: { preset: null, defaultAppearance: null },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('system-settings.theme.reset-done-title', {
      description: 'system-settings.theme.reset-done-description',
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'system-settings.theme.reset' })).toHaveFocus(),
    );
  });

  it('reloads after a conflict and puts focus on the form', async () => {
    vi.mocked(updateAppConfiguration).mockRejectedValue(httpError(409));
    vi.mocked(fetchAppConfiguration).mockResolvedValue(newer);
    renderTheme();

    await userEvent.click(await preset('green'));
    await userEvent.click(saveButton());
    await userEvent.click(
      await screen.findByRole('button', { name: 'system-settings.conflict-reload' }),
    );

    expect(await preset('purple')).toBeChecked();
    expect(screen.queryByText('system-settings.conflict-title')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('radiogroup', { name: 'system-settings.theme.preset-label' }),
      ).toContainElement(document.activeElement as HTMLElement),
    );
  });

  it('says a reload needs a connection when it fails offline', async () => {
    vi.mocked(updateAppConfiguration).mockRejectedValue(httpError(409));
    vi.mocked(fetchAppConfiguration).mockRejectedValue(networkError());
    renderTheme();

    await userEvent.click(await preset('green'));
    await userEvent.click(saveButton());
    await userEvent.click(
      await screen.findByRole('button', { name: 'system-settings.conflict-reload' }),
    );

    expect(await screen.findByText('offline.notice-description')).toBeInTheDocument();
    expect(screen.getByText('system-settings.conflict-title')).toBeInTheDocument();
  });
});
