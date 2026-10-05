import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateValue } from '@/components/form/date-value';
import { fetchLot, updateLot } from '@/features/lots/api/api';
import { lotsListOptions } from '@/features/lots/api/queries';
import { LotFormDialog } from '@/features/lots/components/lot-form-dialog';
import type { Lot } from '@/features/lots/lib/types';
import { fetchOrderablesByTradeItems } from '@/features/reference-data/api/api';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/lots/api/api', () => ({
  fetchLot: vi.fn(),
  fetchLotRows: vi.fn(),
  updateLot: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({ fetchOrderablesByTradeItems: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const lot: Lot = {
  id: 'l1',
  lotCode: 'LC2017A',
  active: true,
  tradeItemId: 't1',
  expirationDate: '2019-01-30',
  manufactureDate: '2017-01-30',
};

const acid = {
  id: 'c1',
  productCode: 'C1',
  fullProductName: 'Acetylsalicylic Acid',
  description: null,
  identifiers: { tradeItem: 't1' },
};

function renderDialog(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderPage(<LotFormDialog onClose={onClose} target="l1" />, { queryClient });
  return queryClient;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchLot).mockResolvedValue(lot);
  vi.mocked(fetchOrderablesByTradeItems).mockResolvedValue([acid]);
});

describe('LotFormDialog', () => {
  it("fills the form with the lot's current values, dates as the table shows them", async () => {
    renderDialog();

    expect(await screen.findByDisplayValue('LC2017A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lots.expiration-date/ })).toHaveTextContent(
      formatDateValue('2019-01-30', 'en'),
    );
    expect(screen.getByRole('button', { name: /lots.manufacture-date/ })).toHaveTextContent(
      formatDateValue('2017-01-30', 'en'),
    );
    expect(await screen.findByText('lots.form.product')).toBeInTheDocument();
    expect(fetchOrderablesByTradeItems).toHaveBeenCalledWith(['t1']);
  });

  it('says the product could not be loaded rather than that there is none', async () => {
    vi.mocked(fetchOrderablesByTradeItems).mockRejectedValue(httpError(500));
    renderDialog();

    expect(await screen.findByText('lots.form.product-error')).toBeInTheDocument();
    expect(screen.queryByText('lots.form.no-product')).not.toBeInTheDocument();
  });

  it('asks for a lot code', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(await screen.findByDisplayValue('LC2017A'));
    await user.click(screen.getByRole('button', { name: 'lots.form.save' }));

    expect(await screen.findByText('lots.form.code-required')).toBeInTheDocument();
    expect(updateLot).not.toHaveBeenCalled();
  });

  it('saves the whole lot, says so and refreshes the list', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(updateLot).mockImplementation(async (body) => body);
    const queryClient = renderDialog(onClose);
    const list = lotsListOptions({ page: 0, size: 10, tradeItemIdIgnored: true });
    queryClient.setQueryData(list.queryKey, {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 10,
    });

    const code = await screen.findByDisplayValue('LC2017A');
    await user.clear(code);
    await user.type(code, 'LC2017B');
    await user.click(screen.getByRole('button', { name: 'lots.form.clear-expiration-date' }));
    await user.click(screen.getByRole('button', { name: 'lots.form.save' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateLot).toHaveBeenCalledWith({ ...lot, lotCode: 'LC2017B', expirationDate: null });
    expect(toast.success).toHaveBeenCalledWith('lots.form.saved-title', {
      description: 'lots.form.saved',
    });
    expect(queryClient.getQueryState(list.queryKey)?.isInvalidated).toBe(true);
  });

  it('shows a code the server found on another lot of the product on the code field', async () => {
    const user = userEvent.setup();
    vi.mocked(updateLot).mockRejectedValue(
      httpError(400, { messageKey: 'referenceData.error.lot.lotCode.mustBeUnique', message: 'x' }),
    );
    renderDialog();

    const code = await screen.findByDisplayValue('LC2017A');
    await user.clear(code);
    await user.type(code, 'LC2018B');
    await user.click(screen.getByRole('button', { name: 'lots.form.save' }));

    expect(await screen.findByText('lots.form.code-taken')).toBeInTheDocument();
  });

  it("shows the server's reason for any other refusal", async () => {
    const user = userEvent.setup();
    vi.mocked(updateLot).mockRejectedValue(
      httpError(400, {
        messageKey: 'referenceData.error.lot.tradeItem.required',
        message: 'Trade item is required',
      }),
    );
    renderDialog();

    await screen.findByDisplayValue('LC2017A');
    await user.click(screen.getByRole('button', { name: 'lots.form.save' }));

    expect(await screen.findByText('Trade item is required')).toBeInTheDocument();
  });

  it('says when the lot no longer exists', async () => {
    vi.mocked(fetchLot).mockRejectedValue(httpError(404));
    renderDialog();

    expect(await screen.findByText('lots.form.not-found')).toBeInTheDocument();
  });
});
