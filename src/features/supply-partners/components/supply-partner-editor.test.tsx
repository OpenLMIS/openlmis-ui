import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { useState } from 'react';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { TranslatedFormMessages } from '@/components/i18n/translated-form-messages';
import {
  facilitiesByIdsOptions,
  orderablesByIdsOptions,
  programsOptions,
  supervisoryNodesByIdsOptions,
} from '@/features/reference-data/api/queries';
import { saveSupplyPartner } from '@/features/supply-partners/api/api';
import { SupplyPartnerEditor } from '@/features/supply-partners/components/supply-partner-editor';
import type { SupplyPartnerEditSearch } from '@/features/supply-partners/lib/search';
import type { SupplyPartner } from '@/features/supply-partners/lib/types';
import { renderPage } from '@/test-utils/render-page';
import en from '../../../../public/locales/en.json';

vi.mock('@/features/supply-partners/api/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/supply-partners/api/api')>()),
  saveSupplyPartner: vi.fn(),
}));
const saved: SupplyPartner = {
  id: 'sp',
  code: 'SUP',
  name: 'Supplier',
  associations: Array.from({ length: 12 }, (_, index) => ({
    program: { id: 'p' },
    supervisoryNode: { id: `n${index}` },
    facilities: [{ id: 'f' }],
    orderables: [{ id: 'o' }],
  })),
};
const onSaved = vi.fn();
function Harness() {
  const [search, setSearch] = useState<SupplyPartnerEditSearch>({ page: 12, size: 1 });
  return (
    <TranslatedFormMessages>
      <SupplyPartnerEditor
        saved={saved}
        search={search}
        onSearchChange={(update) =>
          setSearch((old) => ({ ...old, ...(typeof update === 'function' ? update(old) : update) }))
        }
        canManageNodes={false}
        onAssociation={vi.fn()}
        onCloseAssociation={vi.fn()}
        onOpenProducts={vi.fn()}
        onCloseProducts={vi.fn()}
        onInvalidProducts={vi.fn()}
        onView={vi.fn()}
        onCloseView={vi.fn()}
        onCancel={vi.fn()}
        onSaved={onSaved}
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
      fallbackLng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
});

it('removes the chosen association on the last page and keeps every remaining draft change after a failed save', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(programsOptions().queryKey, [
    { id: 'p', code: 'P', name: 'Program', active: true },
  ]);
  const nodes = saved.associations.map((item, index) => ({
    id: item.supervisoryNode.id,
    code: item.supervisoryNode.id,
    name: `Node ${index}`,
  }));
  for (const subset of [nodes, nodes.slice(0, 11)]) {
    queryClient.setQueryData(
      supervisoryNodesByIdsOptions(subset.map(({ id }) => id).sort()).queryKey,
      subset,
    );
  }
  queryClient.setQueryData(facilitiesByIdsOptions(['f']).queryKey, [
    {
      id: 'f',
      name: 'Facility',
      code: 'F',
      active: true,
      enabled: true,
      type: { id: 'ft', code: 'FT', name: 'Type' },
      geographicZone: { id: 'z', code: 'Z', name: 'Zone', level: { name: 'Level' } },
    },
  ]);
  queryClient.setQueryData(orderablesByIdsOptions(['o']).queryKey, [
    { id: 'o', fullProductName: 'Product', productCode: 'O', description: null },
  ]);
  vi.mocked(saveSupplyPartner).mockRejectedValueOnce(new Error('Rejected save'));
  const user = userEvent.setup();
  renderPage(<Harness />, { queryClient });
  await user.clear(await screen.findByRole('textbox', { name: 'Name' }));
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Edited Supplier');
  await user.click(screen.getByRole('button', { name: 'Actions for Program, Node 11' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
  const confirmation = await screen.findByRole('alertdialog', { name: 'Remove Association' });
  await user.click(within(confirmation).getByRole('button', { name: 'Remove' }));
  await screen.findByRole('button', { name: 'Actions for Program, Node 10' });
  await user.click(screen.getByRole('button', { name: 'Update Supply Partner' }));
  await screen.findByRole('alertdialog', { name: 'Could Not Save Supply Partner' });
  expect(saveSupplyPartner).toHaveBeenCalledWith(saved, {
    name: 'Edited Supplier',
    associations: saved.associations.slice(0, 11).map((item) => ({
      programId: 'p',
      supervisoryNodeId: item.supervisoryNode.id,
      facilityIds: ['f'],
      orderableIds: ['o'],
    })),
  });
  expect(onSaved).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Close' }));
  expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('Edited Supplier');
  await waitFor(() =>
    expect(screen.queryByText('Node 11', { exact: true })).not.toBeInTheDocument(),
  );
  expect(screen.getByText('Node 10', { exact: true })).toBeInTheDocument();
});
