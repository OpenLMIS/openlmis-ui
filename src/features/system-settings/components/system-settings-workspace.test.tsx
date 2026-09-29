import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { savedConfiguration } from '@/features/system-settings/components/settings-fixtures';
import { SystemSettingsLayout } from '@/features/system-settings/components/system-settings-workspace';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/system-settings/api/api', () => ({ fetchAppConfiguration: vi.fn() }));

function renderLayout(saved: typeof savedConfiguration | null) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(appConfigurationOptions().queryKey, saved);
  renderPage(
    <SystemSettingsLayout>
      <p>Tab content</p>
    </SystemSettingsLayout>,
    { path: '/administration/system-settings', queryClient },
  );
}

describe('SystemSettingsLayout', () => {
  it('shows the tabs and the current tab when the server has the settings', async () => {
    renderLayout(savedConfiguration);

    expect(await screen.findByText('Tab content')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'system-settings.tabs.theme' })).toBeInTheDocument();
  });

  it('says the settings are not available on a server without them', async () => {
    renderLayout(null);

    expect(await screen.findByText('system-settings.unavailable-title')).toBeInTheDocument();
    expect(screen.queryByText('Tab content')).not.toBeInTheDocument();
  });
});
