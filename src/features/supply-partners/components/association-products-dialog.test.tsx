import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, expect, it, vi } from 'vitest';
import { AssociationProductsDialog } from '@/features/supply-partners/components/association-products-dialog';
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
it('keeps selection across pages and searches, applies deselections and retains unavailable selected products', async () => {
  const options = Array.from({ length: 23 }, (_, index) => ({
    id: `o${index + 1}`,
    productCode: `P${String(index + 1).padStart(2, '0')}`,
    fullProductName: `Product ${index + 1}`,
    description: null,
  }));
  const old = {
    id: 'old',
    productCode: 'OLD',
    fullProductName: 'Previously selected',
    description: null,
  };
  const onCommit = vi.fn<(ids: string[]) => void>();
  const user = userEvent.setup();
  renderPage(
    <AssociationProductsDialog
      open
      selectedIds={['o1', 'old']}
      selectedProducts={[options[0], old]}
      options={options}
      onCommit={onCommit}
      onClose={vi.fn()}
      onDirtyChange={vi.fn()}
    />,
  );
  const dialog = await screen.findByRole('dialog', { name: 'Add Products' });
  await user.click(within(dialog).getByRole('checkbox', { name: /P01/ }));
  await user.click(within(dialog).getByRole('checkbox', { name: /P02/ }));
  await user.click(within(dialog).getByRole('button', { name: 'Next Page' }));
  await user.click(await within(dialog).findByRole('checkbox', { name: /P11/ }));
  const search = within(dialog).getByRole('textbox', { name: 'Search by name or code' });
  await user.type(search, 'P23{Enter}');
  await user.click(await within(dialog).findByRole('checkbox', { name: /P23/ }));
  expect(onCommit).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: 'Add Products' }));
  expect(onCommit).toHaveBeenCalledOnce();
  expect(new Set(onCommit.mock.calls[0]?.[0])).toEqual(new Set(['old', 'o2', 'o11', 'o23']));
});
