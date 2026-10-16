import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, expect, it } from 'vitest';
import {
  facilitiesByIdsOptions,
  orderablesByIdsOptions,
  programsOptions,
  supervisoryNodesByIdsOptions,
} from '@/features/reference-data/api/queries';
import { ViewItemsDialog } from '@/features/supply-partners/components/view-items-dialog';
import { renderPage } from '@/tests/render-page';
import en from '../../../../public/locales/en.json';

beforeAll(async () => {
  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
});
it('shows resolved facilities even when a product reference is unavailable', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(programsOptions().queryKey, [
    { id: 'p', code: 'P', name: 'Program', active: true },
  ]);
  queryClient.setQueryData(supervisoryNodesByIdsOptions(['n']).queryKey, [
    { id: 'n', code: 'N', name: 'Node' },
  ]);
  queryClient.setQueryData(facilitiesByIdsOptions(['f']).queryKey, [
    {
      id: 'f',
      code: 'F',
      name: 'Facility One',
      active: true,
      enabled: true,
      type: { id: 'ft', code: 'FT', name: 'Type' },
      geographicZone: { id: 'z', code: 'Z', name: 'Zone', level: { name: 'Level' } },
    },
  ]);
  queryClient.setQueryData(orderablesByIdsOptions(['missing']).queryKey, []);
  renderPage(
    <ViewItemsDialog
      search={{ view: 'facilities', viewAssociation: 'p:n' }}
      associations={[
        { programId: 'p', supervisoryNodeId: 'n', facilityIds: ['f'], orderableIds: ['missing'] },
      ]}
      pending={false}
      onClose={() => {}}
    />,
    { queryClient },
  );
  expect(await screen.findByText('Facility One')).toBeVisible();
  expect(screen.getByText(en['supply-partners.missing-references'])).toBeVisible();
});
