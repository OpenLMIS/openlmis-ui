import { QueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateAppConfiguration } from '@/features/system-settings/api/api';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { savedConfiguration } from '@/features/system-settings/components/settings-fixtures';
import { SystemSettingsWorkspace } from '@/features/system-settings/components/system-settings-workspace';
import { ThemeSettings } from '@/features/system-settings/components/theme-settings';
import { httpError } from '@/tests/http-error';
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
  const queryClient = new QueryClient();
  queryClient.setQueryData(appConfigurationOptions().queryKey, savedConfiguration);
  renderPage(
    <SystemSettingsWorkspace>
      <FromCache />
    </SystemSettingsWorkspace>,
    { path: '/administration/system-settings/theme', queryClient },
  );
}

beforeEach(() => vi.resetAllMocks());

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
});
