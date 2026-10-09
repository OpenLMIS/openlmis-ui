import { QueryClient } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import {
  ProductLotPicker,
  ProductLotPickerSkeleton,
} from '@/features/stock-events/components/product-lot-picker';
import { allEventCards } from '@/features/stock-events/lib/products';
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
  it('keeps the product field label while announcing loading only to screen readers', async () => {
    renderPage(
      <I18nextProvider i18n={i18n}>
        <ProductLotPickerSkeleton />
      </I18nextProvider>,
    );
    const label = await screen.findByText('Product');
    expect(label).toBeVisible();
    expect(label.parentElement).toHaveTextContent('*');
    expect(screen.queryByText('Lot Code')).not.toBeInTheDocument();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(en['stock-events.products-loading']);
    expect(status).toHaveClass('sr-only');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it.each([true, false])('requires an explicit lot choice with no-lot option %s', async (noLot) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData(
      eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
      [
        card,
        {
          ...card,
          id: 'ibuprofen',
          lot: null,
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
          cardFilter={allEventCards}
          onAdd={onAdd}
        />
      </I18nextProvider>,
      { queryClient },
    );
    const product = await screen.findByRole('combobox', { name: 'Product' });
    expect(screen.queryByRole('combobox', { name: 'Lot Code' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
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
    expect(screen.queryByRole('combobox', { name: 'Lot Code' })).not.toBeInTheDocument();
    expect(add).toBeEnabled();
  });
});

it.each([true, false])(
  'picks the sole offered product and lot, including no-lot %s',
  async (noLot) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const offered = { ...card, lot: noLot ? null : card.lot };
    queryClient.setQueryData(
      eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
      [
        offered,
        { ...card, orderable: { ...card.orderable, id: 'hidden', fullProductName: 'Hidden' } },
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
          cardFilter={(cards) => cards.filter((item) => item.orderable.id !== 'hidden')}
          onAdd={onAdd}
        />
      </I18nextProvider>,
      { queryClient },
    );
    expect(await screen.findByRole('combobox', { name: 'Product' })).toHaveValue('Aspirin');
    if (noLot) expect(screen.queryByRole('combobox', { name: 'Lot Code' })).not.toBeInTheDocument();
    else expect(screen.getByRole('combobox', { name: 'Lot Code' })).toHaveTextContent('LOT');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith(offered);
    await user.click(screen.getByRole('combobox', { name: 'Product' }));
    expect(screen.queryByRole('option', { name: 'Hidden' })).not.toBeInTheDocument();
  },
);

it('keeps an automatically picked lot when a refresh adds another option', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const queryKey = eventStockCardsOptions({
    facilityId: 'facility',
    programId: 'program',
  }).queryKey;
  queryClient.setQueryData(queryKey, [card]);
  const onAdd = vi.fn();
  const user = userEvent.setup();
  renderPage(
    <I18nextProvider i18n={i18n}>
      <ProductLotPicker
        facilityId="facility"
        programId="program"
        disabled={false}
        cardFilter={allEventCards}
        onAdd={onAdd}
      />
    </I18nextProvider>,
    { queryClient },
  );
  expect(await screen.findByRole('combobox', { name: 'Product' })).toHaveValue('Aspirin');
  expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  await act(async () =>
    queryClient.setQueryData(queryKey, [
      card,
      { ...card, lot: { id: 'other', lotCode: 'OTHER', expirationDate: null } },
    ]),
  );
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(onAdd).toHaveBeenCalledWith(card);
});
