import { onlineManager, QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import { expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import {
  deploymentTimeZoneOptions,
  homeFacilityOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { parsePermissions } from '@/lib/permissions';
import { StockEventProgramPicker } from '@/routes/(protected)/-stock-event-program-picker';
import { renderPage } from '@/tests/render-page';

vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));
vi.mock('@/features/stock-events/hooks/use-device-events', () => ({
  useDeviceEvents: () => ({
    events: [
      { kind: 'adjustment', status: 'queued' },
      { kind: 'issue', status: 'queued' },
      { kind: 'adjustment', status: 'accepted' },
    ] as DeviceEvent[],
  }),
}));
it.each([true, false])(
  'shows pending work for this kind with connection-specific copy (online=%s)',
  async (online) => {
    onlineManager.setOnline(online);
    const language = createInstance();
    await language.use(ICU).init({
      lng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const program = { id: 'p', code: 'P', name: 'Medicines', active: true };
    client.setQueryData(userRecordOptions('u').queryKey, {
      id: 'u',
      username: 'u',
      firstName: '',
      lastName: '',
      active: true,
      homeFacilityId: 'f',
      roleAssignments: [],
    });
    client.setQueryData(userProgramsOptions('u').queryKey, [program]);
    client.setQueryData(homeFacilityOptions('f').queryKey, {
      id: 'f',
      code: 'F',
      name: 'Clinic',
      active: true,
      enabled: true,
      type: { id: 'type', code: 'T', name: 'Type' },
      geographicZone: { id: 'z', code: 'Z', name: 'Zone', level: { name: 'District' } },
      supportedPrograms: [{ ...program, supportActive: true, supportLocallyFulfilled: false }],
    });
    client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
    renderPage(
      <I18nextProvider i18n={language}>
        <StockEventProgramPicker
          userId="u"
          permissions={parsePermissions(['STOCK_ADJUST|f|p'])}
          kind="adjustment"
          editorLink={() => <a href="/edit">Edit</a>}
        />
      </I18nextProvider>,
      { queryClient: client },
    );
    expect(await screen.findByRole('note')).toHaveTextContent(
      online
        ? '1 adjustment is waiting to sync or needs review.'
        : "You're offline. 1 adjustment is waiting to sync.",
    );
    if (!online) expect(screen.getByText("You're offline.").tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: 'Offline Events' })).toHaveAttribute(
      'href',
      '/offline-events',
    );
    expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument();
  },
);
