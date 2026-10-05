import { QueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { useState } from 'react';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateAppConfiguration } from '@/features/system-settings/api/api';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import { FeatureFlagsSettings } from '@/features/system-settings/components/feature-flags-settings';
import { savedConfiguration } from '@/features/system-settings/components/settings-fixtures';
import { SystemSettingsWorkspace } from '@/features/system-settings/components/system-settings-workspace';
import type { AppConfigurationDto } from '@/features/system-settings/lib/types';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/system-settings/api/api', () => ({
  fetchAppConfiguration: vi.fn(),
  updateAppConfiguration: vi.fn(),
}));
vi.mock('@/lib/runtime-config', () => ({ getDeploymentFlags: () => ({ GS1_SCANNING: 'true' }) }));

function FromCache({ initialSearch }: { initialSearch: string }) {
  const { data } = useSuspenseQuery({ ...appConfigurationOptions(), staleTime: Infinity });
  const [search, setSearch] = useState(initialSearch);
  return data ? (
    <FeatureFlagsSettings onSearchChange={setSearch} saved={data} search={search} />
  ) : null;
}

function renderFlags(saved: AppConfigurationDto = savedConfiguration, initialSearch = '') {
  const queryClient = new QueryClient();
  queryClient.setQueryData(appConfigurationOptions().queryKey, saved);
  renderPage(
    <SystemSettingsWorkspace>
      <FromCache initialSearch={initialSearch} />
    </SystemSettingsWorkspace>,
    { path: '/settings/feature-flags', queryClient },
  );
}

const batch = () =>
  screen.findByRole('switch', { name: /feature-flags.batch-approve-screen.label/ });
const saveButton = () => screen.getByRole('button', { name: 'system-settings.save' });

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: 'en', resources: {} });
});

beforeEach(() => vi.resetAllMocks());

describe('FeatureFlagsSettings', () => {
  it('tells each flag where its value comes from, and follows the draft', async () => {
    renderFlags();

    expect(
      await screen.findByRole('switch', { name: /feature-flags.gs1-scanning.label/ }),
    ).toHaveAccessibleDescription(/system-settings.flags.from-deployment/);
    expect(await batch()).toHaveAccessibleDescription('BATCH_APPROVE_SCREEN');

    await userEvent.click(await batch());

    expect(await batch()).toHaveAccessibleDescription(/system-settings.flags.changed-default/);
    const reset = screen.getByRole('button', { name: 'system-settings.flags.reset-label' });

    await userEvent.click(reset);

    expect(await batch()).not.toBeChecked();
    expect(saveButton()).toBeDisabled();
  });

  it('shows a stored value equal to the deployment as Changed Here, and Reset removes it', async () => {
    vi.mocked(updateAppConfiguration).mockResolvedValue({ ...savedConfiguration, version: 4 });
    const saved = { ...savedConfiguration, featureFlags: { GS1_SCANNING: true } };
    renderFlags(saved);
    const gs1 = () => screen.findByRole('switch', { name: /feature-flags.gs1-scanning.label/ });

    expect(await gs1()).toHaveAccessibleDescription(/system-settings.flags.changed-deployment/);
    expect(saveButton()).toBeDisabled();

    await userEvent.click(
      screen.getByRole('button', { name: 'system-settings.flags.reset-label' }),
    );

    expect(await gs1()).toHaveAccessibleDescription(/system-settings.flags.from-deployment/);
    expect(await gs1()).toHaveFocus();
    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(updateAppConfiguration).toHaveBeenCalledWith(saved, { featureFlags: {} }),
    );
  });

  it('keeps what each flag does behind its info button', async () => {
    renderFlags();
    await batch();

    expect(
      screen.queryByText('feature-flags.batch-approve-screen.description'),
    ).not.toBeInTheDocument();

    const info = screen.getAllByRole('button', {
      name: 'system-settings.flags.about-label',
    })[0] as HTMLElement;

    await userEvent.click(info);

    const about = await screen.findByRole('dialog');
    expect(about).toHaveTextContent('feature-flags.batch-approve-screen.description');
    expect(about).toHaveTextContent('feature-flags.batch-approve-screen.label');
    expect(about).toHaveTextContent('system-settings.flags.used-by');
    expect(about).not.toHaveTextContent('feature-flags.gs1-scanning.description');
  });

  it('shows each flag key under its name', async () => {
    renderFlags();

    expect(await batch()).toHaveAccessibleDescription(/BATCH_APPROVE_SCREEN/);
  });

  it('saves only what differs from what each flag inherits', async () => {
    vi.mocked(updateAppConfiguration).mockResolvedValue({ ...savedConfiguration, version: 4 });
    renderFlags();

    await userEvent.click(await batch());
    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(updateAppConfiguration).toHaveBeenCalledWith(savedConfiguration, {
        featureFlags: { BATCH_APPROVE_SCREEN: true },
      }),
    );
  });

  it('opens unchanged even when a stored value is not one this version accepts', async () => {
    renderFlags({ ...savedConfiguration, featureFlags: { DEFAULT_QUANTITY_UNIT: 'BOTH' } });

    expect(
      await screen.findByRole('combobox', { name: /feature-flags.default-quantity-unit.label/ }),
    ).toHaveTextContent('feature-flags.quantity-unit.doses');
    expect(
      screen.queryByRole('button', { name: 'system-settings.flags.reset-label' }),
    ).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('keeps the draft and blocks Save after someone else saved', async () => {
    vi.mocked(updateAppConfiguration).mockRejectedValue(httpError(409));
    renderFlags();

    await userEvent.click(await batch());
    await userEvent.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('system-settings.conflict-title');
    expect(await batch()).toBeChecked();
    expect(saveButton()).toBeDisabled();
  });

  it('filters the flags by name or key as you search', async () => {
    renderFlags();
    await batch();
    const search = screen.getByRole('textbox', { name: 'system-settings.flags.search-label' });

    await userEvent.type(search, 'gs1_scan');

    await waitFor(() => expect(screen.getAllByRole('switch')).toHaveLength(1));
    expect(
      screen.getByRole('switch', { name: /feature-flags.gs1-scanning.label/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('says when nothing matches, and Clear Filters brings every flag back and the focus to search', async () => {
    renderFlags();
    await batch();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'system-settings.flags.search-label' }),
      'nothing like this',
    );

    expect(await screen.findByText('system-settings.flags.no-match-title')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'system-settings.flags.clear-filters' }),
    );

    await waitFor(() => expect(screen.getAllByRole('switch')).toHaveLength(3));
    expect(
      screen.getByRole('textbox', { name: 'system-settings.flags.search-label' }),
    ).toHaveFocus();
  });

  it('also finds a flag by the screen that uses it or what it does', async () => {
    renderFlags();
    await batch();
    const search = screen.getByRole('textbox', { name: 'system-settings.flags.search-label' });

    await userEvent.type(search, 'gs1-scanning.used-by');
    await waitFor(() => expect(screen.getAllByRole('switch')).toHaveLength(1));
    expect(screen.getByRole('switch')).toHaveAccessibleName(/feature-flags.gs1-scanning.label/);

    await userEvent.clear(search);
    await userEvent.type(search, 'batch-approve-screen.description');
    await waitFor(() =>
      expect(screen.getByRole('switch')).toHaveAccessibleName(
        /feature-flags.batch-approve-screen.label/,
      ),
    );
  });

  it('starts from the search it was opened with', async () => {
    renderFlags(savedConfiguration, 'gs1');

    expect(
      await screen.findByRole('switch', { name: /feature-flags.gs1-scanning.label/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(1);
  });

  it('keeps a change to a flag the search hides, and saves it', async () => {
    vi.mocked(updateAppConfiguration).mockResolvedValue({ ...savedConfiguration, version: 4 });
    renderFlags();
    await userEvent.click(await batch());

    await userEvent.type(
      screen.getByRole('textbox', { name: 'system-settings.flags.search-label' }),
      'gs1',
    );
    await waitFor(() => expect(screen.getAllByRole('switch')).toHaveLength(1));
    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(updateAppConfiguration).toHaveBeenCalledWith(savedConfiguration, {
        featureFlags: { BATCH_APPROVE_SCREEN: true },
      }),
    );
  });
});
