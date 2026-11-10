import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { FulfillOrderButton } from '@/features/orders/components/order-row-buttons';
import { orderSummary } from '@/test-utils/order-fixtures';
import { renderPage } from '@/test-utils/render-page';

it.each(['ORDERED', 'FULFILLING'])(
  'links the %s order to its shipment with list return state',
  async (status) => {
    const router = renderPage(
      <FulfillOrderButton
        order={{ ...orderSummary('a'), status }}
        search={{ page: 3 }}
        disabled={false}
      />,
    );
    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', '/orders/fulfillment/a');
    await userEvent.setup().click(link);
    await waitFor(() =>
      expect(router.state.location.state.orderReturn).toEqual({
        to: '/orders/fulfillment',
        search: { page: 3 },
      }),
    );
  },
);
