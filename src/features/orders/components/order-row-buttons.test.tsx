import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, expect, it, vi } from 'vitest';
import { InCardContext } from '@/components/display/card-actions';
import { Toaster } from '@/components/ui/sonner';
import { retryOrderTransfer } from '@/features/orders/api/api';
import { OrderRowButtons } from '@/features/orders/components/order-row-buttons';
import { queryKeys } from '@/lib/key-factory';
import { orderSummary } from '@/test-utils/order-fixtures';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/orders/api/api', () => ({
  retryOrderTransfer: vi.fn(),
  fetchOrderPdf: vi.fn(),
  fetchOrderCsv: vi.fn(),
}));
const i18n = createInstance();
await i18n.init({
  lng: 'en',
  keySeparator: false,
  resources: { en: { translation: { 'orders.action-for': '{{action}}: Order {{order}}' } } },
});
beforeEach(() => vi.resetAllMocks());

it.each(['false', 'true', 'rejected'] as const)(
  'reports Retry outcome %s and invalidates only after success',
  async (outcome) => {
    const response = Promise.withResolvers<{ result: boolean }>();
    vi.mocked(retryOrderTransfer).mockReturnValue(response.promise);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const orders = queryKeys.orders.list({});
    const home = [...queryKeys.home.all, 'counts'];
    client.setQueryData(orders, {});
    client.setQueryData(home, {});
    const user = userEvent.setup();
    renderPage(
      <I18nextProvider i18n={i18n}>
        <OrderRowButtons
          order={{ ...orderSummary('a'), status: 'TRANSFER_FAILED' }}
          search={{}}
          access={{ canEdit: false, retrySupplierIds: ['supplier'] }}
          disabled={false}
        />
        <Toaster />
      </I18nextProvider>,
      { queryClient: client },
    );
    await user.click(await screen.findByRole('button', { name: 'card-actions.actions-for' }));
    await user.click(await screen.findByRole('menuitem', { name: 'orders.retry: Order ORDER-A' }));
    await waitFor(() => expect(retryOrderTransfer).toHaveBeenCalledWith('a'));
    await user.click(screen.getByRole('button', { name: 'card-actions.actions-for' }));
    const pendingRetry = await screen.findByRole('menuitem', {
      name: 'orders.retry: Order ORDER-A',
    });
    expect(pendingRetry).toHaveAttribute('aria-disabled', 'true');
    await user.click(pendingRetry);
    expect(retryOrderTransfer).toHaveBeenCalledOnce();
    await user.keyboard('{Escape}');
    if (outcome === 'rejected')
      response.reject(
        new AxiosError('Denied', undefined, undefined, undefined, {
          status: 400,
          data: { message: 'Cannot transfer this order' },
        } as never),
      );
    else response.resolve({ result: outcome === 'true' });
    const description = await screen.findByText(
      outcome === 'rejected'
        ? 'Cannot transfer this order'
        : outcome === 'true'
          ? 'orders.retry-success-description'
          : 'orders.retry-error-description',
    );
    await waitFor(() => expect(description).toBeVisible());
    expect(description.closest('[data-sonner-toast]')).toHaveTextContent(
      outcome === 'true' ? 'orders.retry-success-title' : 'orders.retry-error-title',
    );
    await waitFor(() => {
      expect(client.getQueryState(orders)?.isInvalidated).toBe(outcome === 'true');
      expect(client.getQueryState(home)?.isInvalidated).toBe(outcome === 'true');
    });
  },
);

it('identifies the order in row actions', async () => {
  const cards = false;
  const user = userEvent.setup();
  renderPage(
    <I18nextProvider i18n={i18n}>
      <InCardContext value={cards}>
        <OrderRowButtons
          order={orderSummary('b')}
          search={{}}
          access={{ canEdit: false, retrySupplierIds: [] }}
          disabled={false}
        />
      </InCardContext>
    </I18nextProvider>,
  );
  if (!cards)
    await user.click(await screen.findByRole('button', { name: 'card-actions.actions-for' }));
  const role = cards ? 'button' : 'menuitem';
  expect(await screen.findByRole(role, { name: 'orders.print: Order ORDER-B' })).toBeVisible();
  expect(screen.getByRole(role, { name: 'orders.download: Order ORDER-B' })).toBeVisible();
});
