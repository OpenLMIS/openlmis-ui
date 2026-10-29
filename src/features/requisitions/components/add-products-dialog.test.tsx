import { QueryClient } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { orderablesByIdentitiesOptions } from '@/features/reference-data/api/queries';
import { AddProductsDialog } from '@/features/requisitions/components/add-products-dialog';
import { renderPage } from '@/tests/render-page';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
});

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
it('returns ticked products across pages and name or code searches', async () => {
  const options = Array.from({ length: 23 }, (_, index) => ({
    id: `o${index + 1}`,
    productCode: `P${String(index + 1).padStart(2, '0')}`,
    fullProductName: `Product ${index + 1}`,
    description: null,
  }));
  const onSave = vi.fn();
  const user = userEvent.setup();
  const identities = options.map(({ id }) => ({ id, versionNumber: 1 }));
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  queryClient.setQueryData(orderablesByIdentitiesOptions(identities).queryKey, options);
  renderPage(
    <AddProductsDialog
      load={{ identities, select: (products) => products }}
      onSave={onSave}
      onClose={vi.fn()}
    />,
    { queryClient },
  );
  const dialog = await screen.findByRole('dialog', { name: 'Add Products' });
  await user.click(within(dialog).getByRole('checkbox', { name: /Product 2$/ }));
  await user.click(within(dialog).getByRole('button', { name: 'Next Page' }));
  await user.click(await within(dialog).findByRole('checkbox', { name: /Product 11$/ }));
  const search = within(dialog).getByRole('textbox', { name: 'Search By Name Or Code' });
  await user.type(search, 'P23{Enter}');
  await user.click(await within(dialog).findByRole('checkbox', { name: /Product 23$/ }));
  await user.clear(search);
  await user.type(search, 'Product 2');
  await user.click(await within(dialog).findByRole('checkbox', { name: /Product 2$/ }));
  expect(onSave).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: 'Add 2 Products' }));
  expect(onSave).toHaveBeenCalledOnce();
  expect(onSave).toHaveBeenCalledWith([options[10], options[22]]);
});
