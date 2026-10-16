import { QueryClient } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, expect, it, vi } from 'vitest';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
import {
  facilitiesByIdsOptions,
  facilityTypeApprovedOrderablesOptions,
  orderablesByIdsOptions,
  programsOptions,
  supervisoryNodesByIdsOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import { SupplyPartnerEditor } from '@/features/supply-partners/components/supply-partner-editor';
import {
  type SupplyPartnerEditSearch,
  supplyPartnerEditSearchSchema,
} from '@/features/supply-partners/lib/search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { renderPage } from '@/tests/render-page';
import en from '../../../../public/locales/en.json';

const CLOSED = {
  association: undefined,
  products: undefined,
  view: undefined,
  viewAssociation: undefined,
};
const saved = {
  id: 'sp',
  code: 'SUP',
  name: 'Supplier',
  associations: [
    {
      program: { id: 'p' },
      supervisoryNode: { id: 'n' },
      facilities: [{ id: 'f' }],
      orderables: [{ id: 'o' }],
    },
  ],
};
function Harness() {
  const search = supplyPartnerEditSearchSchema.parse(useLocation().search);
  const nav = useSearchNavigation<SupplyPartnerEditSearch>(CLOSED);
  return (
    <TranslatedFormMessages>
      <SupplyPartnerEditor
        saved={saved}
        search={search}
        canManageNodes={false}
        onSearchChange={nav.updateSearch}
        onAssociation={(key) => void nav.openDialog({ association: key })}
        onCloseAssociation={nav.closeDialog}
        onOpenProducts={vi.fn()}
        onCloseProducts={vi.fn()}
        onView={vi.fn()}
        onCloseView={vi.fn()}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onReload={vi.fn()}
      />
    </TranslatedFormMessages>
  );
}
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
it('keeps the dirty association copy open after Cancel is refused and commits none of its changes to the page', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const node = { id: 'n', code: 'N', name: 'Node', partnerNodeOf: { id: 'parent' } };
  const product = { id: 'o', productCode: 'O', fullProductName: 'Product One', description: null };
  queryClient.setQueryData(programsOptions().queryKey, [
    { id: 'p', code: 'P', name: 'Program', active: true },
  ]);
  queryClient.setQueryData(supervisoryNodesOptions().queryKey, [node]);
  queryClient.setQueryData(supervisoryNodesByIdsOptions(['n']).queryKey, [node]);
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
  queryClient.setQueryData(orderablesByIdsOptions(['o']).queryKey, [product]);
  queryClient.setQueryData(orderablesByIdsOptions([]).queryKey, []);
  queryClient.setQueryData(
    facilityTypeApprovedOrderablesOptions({ facilityTypeCodes: ['FT'], programCode: 'P' }).queryKey,
    [product],
  );
  const user = userEvent.setup();
  renderPage(<Harness />, { queryClient, path: '/?association=p:n' });
  const association = await screen.findByRole('dialog', { name: 'Edit Association' });
  await user.click(await within(association).findByRole('button', { name: 'Remove Product One' }));
  await user.click(within(association).getByRole('button', { name: 'Cancel' }));
  const discard = await screen.findByRole('alertdialog', { name: en['discard-changes.title'] });
  await user.click(
    within(discard).getByRole('button', { name: en['discard-changes.keep-editing'] }),
  );
  const restored = await screen.findByRole('dialog', { name: 'Edit Association' });
  expect(within(restored).queryByText('Product One')).not.toBeInTheDocument();
  await user.click(within(restored).getByRole('button', { name: 'Cancel' }));
  const again = await screen.findByRole('alertdialog', { name: en['discard-changes.title'] });
  await user.click(within(again).getByRole('button', { name: en['discard-changes.discard'] }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Edit Association' })).not.toBeInTheDocument(),
  );
  expect(screen.getByText('1 product')).toBeVisible();
});
