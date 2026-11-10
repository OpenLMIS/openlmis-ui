import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { FulfillOrderButton } from '@/features/orders/components/order-row-buttons';
import { orderSummary } from '@/test-utils/order-fixtures';
import { renderPage } from '@/test-utils/render-page';

it.each(['ORDERED', 'FULFILLING'])(
  'links the %s order to its shipment with list return state',
  async (status) => {
    renderPage(
      <FulfillOrderButton
        order={{ ...orderSummary('a'), status }}
        search={{ page: 3 }}
        disabled={false}
      />,
    );
    expect(await screen.findByRole('link')).toHaveAttribute('href', '/orders/fulfillment/a');
  },
);
