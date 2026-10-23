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
import type { ConfiguredEventKind } from '@/features/stock-events/lib/event-kinds';
import type { HomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { parsePermissions } from '@/lib/permissions';
import { StockEventProgramPicker } from '@/routes/(protected)/-stock-event-program-picker';
import { offlineAccessFixture } from '@/tests/offline-access';
import { renderPage } from '@/tests/render-page';

vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));
vi.mock('@/features/stock-events/hooks/use-offline-events', () => ({
  useOfflineEvents: () => ({
    events: [
      { kind: 'adjustment', status: 'queued' },
      { kind: 'issue', status: 'queued' },
      { kind: 'adjustment', status: 'accepted' },
      { kind: 'receive', status: 'queued' },
    ] as DeviceEvent[],
  }),
}));
it.each([
  { kind: 'adjustment', online: true, view: true },
  { kind: 'adjustment', online: false, view: true },
  { kind: 'adjustment', online: false, view: false },
  { kind: 'issue', online: false, view: true },
  { kind: 'receive', online: false, view: true },
] satisfies { kind: ConfiguredEventKind; online: boolean; view: boolean }[])(
  'shows pending work for this kind with connection-specific copy (%o)',
  async ({ kind, online, view }) => {
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'u', username: 'u', accessToken: 'token' });
    await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).clear();
    await getLocalDb().table(LOCAL_TABLES.receiveCatalogDownloads).clear();
    onlineManager.setOnline(online);
    const language = createInstance();
    await language.use(ICU).init({
      lng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const permissions = ['STOCK_ADJUST|f|p', ...(view ? ['STOCK_CARDS_VIEW|f|p'] : [])];
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
    await getLocalDb()
      .table(LOCAL_TABLES.offlineAccess)
      .put(
        offlineAccessFixture({
          userId: 'u',
          home: { id: 'f' },
          programs: [program],
          rights: permissions,
        }),
      );
    client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
    renderPage(
      <I18nextProvider i18n={language}>
        <StockEventProgramPicker
          userId="u"
          permissions={parsePermissions(permissions)}
          kind={kind}
          editorLink={() => <a href="/edit">Edit</a>}
        />
      </I18nextProvider>,
      { queryClient: client },
    );
    const eventName = kind === 'receive' ? 'receipt' : kind;
    expect(await screen.findByRole('note')).toHaveTextContent(
      online
        ? `1 ${eventName} is waiting to sync or needs review.`
        : `You're offline. 1 ${eventName} is waiting to sync.`,
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
      const reason =
        en[
          view
            ? 'stock-programs.offline-description'
            : 'stock-programs.no-stock-card-right-description'
        ];
      await waitFor(() => expect(action).toHaveAccessibleDescription(reason));
      expect(screen.getByText(reason)).not.toHaveClass('sr-only');
      expect(screen.getByText('Not Downloaded')).toBeInTheDocument();
      if (!view) return;
      await act(async () => {
        await getLocalDb()
          .table(LOCAL_TABLES.homeStockDownloads)
          .put({
            facilityId: 'f',
            facilityTypeId: 'type',
            programId: 'p',
            userId: 'u',
            formatVersion: kind === 'adjustment' ? 4 : 5,
            summaries: [],
            products: [],
            generation: 'available',
            fetchedAt: Date.now(),
            scanning: false,
            cards: [],
            reasons: [],
            tradeItems: [],
            identities: [],
          } satisfies HomeStockBundle);
      });
      if (kind !== 'adjustment') {
        await waitFor(() =>
          expect(action).toHaveAccessibleDescription(
            en['stock-programs.older-download-description'],
          ),
        );
        expect(action).toHaveAttribute('aria-disabled', 'true');
        await act(async () => {
          await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).update(['f', 'p'], {
            formatVersion: 6,
            destinations: [],
            sources: [],
          });
        });
      }
      if (kind === 'receive') {
        await waitFor(() =>
          expect(action).toHaveAccessibleDescription(
            en['stock-programs.catalog-missing-description'],
          ),
        );
        expect(action).toHaveAttribute('aria-disabled', 'true');
        await act(async () => {
          await getLocalDb().table(LOCAL_TABLES.receiveCatalogDownloads).put({
            facilityId: 'f',
            facilityTypeId: 'type',
            programId: 'p',
            userId: 'u',
            formatVersion: 1,
            generation: 'catalog',
            fetchedAt: Date.now(),
            scanning: false,
            approved: [],
            products: [],
            lots: [],
            tradeItems: [],
            fulfils: {},
          });
        });
      }
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
