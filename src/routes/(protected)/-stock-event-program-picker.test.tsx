import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import { expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  deploymentTimeZoneOptions,
  homeFacilityOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import type { HomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { getLocalDb } from '@/integrations/local-db';
import { parsePermissions } from '@/lib/permissions';
import { StockEventProgramPicker } from '@/routes/(protected)/-stock-event-program-picker';
import { renderPage } from '@/tests/render-page';

vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));
vi.mock('@/features/stock-events/hooks/use-offline-events', () => ({
  useOfflineEvents: () => ({
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
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'u', username: 'u', accessToken: 'token' });
    await getLocalDb().table('homeStockDownloads').clear();
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
    const action = await screen.findByRole('link', { name: 'Edit' });
    if (online) {
      expect(action).not.toHaveAttribute('aria-disabled', 'true');
      expect(screen.queryByText('Not Available Offline')).not.toBeInTheDocument();
    } else {
      expect(action).toHaveAttribute('aria-disabled', 'true');
      expect(action).toHaveAccessibleDescription(en['stock-programs.offline-description']);
      await act(async () => {
        await getLocalDb()
          .table('homeStockDownloads')
          .put({
            facilityId: 'f',
            facilityTypeId: 'type',
            programId: 'p',
            userId: 'u',
            formatVersion: 3,
            generation: 'available',
            fetchedAt: Date.now(),
            scanning: false,
            summaries: [],
            products: [],
            cards: [],
            reasons: [],
            tradeItems: [],
            identities: [],
          } satisfies HomeStockBundle);
      });
      await waitFor(() =>
        expect(screen.getByRole('link', { name: 'Edit' })).not.toHaveAttribute(
          'aria-disabled',
          'true',
        ),
      );
      expect(screen.queryByText('Not Available Offline')).not.toBeInTheDocument();
    }
  },
);
