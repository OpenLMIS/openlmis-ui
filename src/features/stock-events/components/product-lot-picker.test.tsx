import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import { ProductLotPicker } from '@/features/stock-events/components/product-lot-picker';
import type { EventStockCard } from '@/features/stock-events/lib/types';
import { renderPage } from '@/tests/render-page';

const i18n = createInstance();
beforeAll(() =>
  i18n.init({ lng: 'en', resources: { en: { translation: en } }, keySeparator: false }),
);
const card: EventStockCard = {
  id: 'card',
  stockOnHand: 50,
  orderable: { id: 'product', productCode: 'C1', fullProductName: 'Aspirin', netContent: 16 },
  lot: { id: 'lot', lotCode: 'LOT', expirationDate: null },
};

describe('ProductLotPicker', () => {
  it.each([true, false])('requires an explicit lot choice with no-lot option %s', async (noLot) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData(
      eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
      [
        card,
        {
          ...card,
          id: 'ibuprofen',
          orderable: { ...card.orderable, id: 'ibuprofen', fullProductName: 'Ibuprofen' },
        },
        {
          ...card,
          id: 'other',
          lot: noLot ? null : { id: 'other-lot', lotCode: 'OTHER', expirationDate: null },
        },
      ],
    );
    const onAdd = vi.fn();
    const user = userEvent.setup();
    renderPage(
      <I18nextProvider i18n={i18n}>
        <ProductLotPicker
          facilityId="facility"
          programId="program"
          disabled={false}
          onAdd={onAdd}
        />
      </I18nextProvider>,
      { queryClient },
    );
    const product = await screen.findByRole('combobox', { name: 'Product' });
    await user.click(product);
    await user.click(await screen.findByRole('option', { name: 'Aspirin' }));
    const lot = screen.getByRole('combobox', { name: 'Lot Code' });
    const add = screen.getByRole('button', { name: 'Add' });
    expect(lot).toHaveTextContent('Lot Code');
    expect(add).toBeDisabled();
    await user.click(add);
    expect(onAdd).not.toHaveBeenCalled();
    await user.click(lot);
    await user.click(await screen.findByRole('option', { name: noLot ? 'No Lot Defined' : 'LOT' }));
    expect(add).toBeEnabled();
    await user.click(add);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ lot: noLot ? null : card.lot }));
    await user.click(product);
    await user.click(await screen.findByRole('option', { name: 'Ibuprofen' }));
    expect(lot).toHaveTextContent('Lot Code');
    expect(add).toBeDisabled();
  });
});
