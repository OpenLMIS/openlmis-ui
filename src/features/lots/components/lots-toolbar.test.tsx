import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LotsToolbar } from '@/features/lots/components/lots-toolbar';
import { fetchOrderables, fetchOrderablesByIds } from '@/features/reference-data/api/api';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/reference-data/api/api', () => ({
  fetchOrderables: vi.fn(),
  fetchOrderablesByIds: vi.fn(),
}));

const acid = {
  id: '2400e410-b8dd-4954-b1c0-80d8a8e785fc',
  productCode: 'C1',
  fullProductName: 'Acetylsalicylic Acid',
  description: null,
};

const columnView = {
  visibility: {},
  onVisibilityChange: vi.fn(),
  onReset: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchOrderables).mockResolvedValue({
    content: [acid],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 20,
  });
  vi.mocked(fetchOrderablesByIds).mockResolvedValue([acid]);
});

describe('LotsToolbar', () => {
  it('searches for products only once the product filter is opened', async () => {
    renderPage(<LotsToolbar columnView={columnView} onFilterChange={vi.fn()} search={{}} />);
    const user = userEvent.setup();

    const product = await screen.findByRole('combobox', { name: 'lots.product' });
    expect(fetchOrderables).not.toHaveBeenCalled();
    await user.click(product);

    expect(await screen.findByRole('option', { name: /Acetylsalicylic Acid/ })).toBeInTheDocument();
  });

  it('filters by a product found on the server, back on the first page', async () => {
    const onFilterChange = vi.fn();
    renderPage(
      <LotsToolbar columnView={columnView} onFilterChange={onFilterChange} search={{ page: 2 }} />,
    );
    const user = userEvent.setup();

    await user.type(await screen.findByRole('combobox', { name: 'lots.product' }), 'acid');
    await waitFor(() => expect(fetchOrderables).toHaveBeenCalledWith('acid'));
    await user.click(await screen.findByRole('option', { name: /Acetylsalicylic Acid/ }));

    expect(onFilterChange).toHaveBeenCalledWith({ product: acid.id, page: undefined });
  });

  it('names the product a link filters by', async () => {
    renderPage(
      <LotsToolbar
        columnView={columnView}
        onFilterChange={vi.fn()}
        search={{ product: acid.id }}
      />,
    );

    expect(await screen.findByDisplayValue('Acetylsalicylic Acid')).toBeInTheDocument();
    expect(fetchOrderablesByIds).toHaveBeenCalledWith([acid.id]);
  });

  it('filters by the earliest expiry date, never after the latest', async () => {
    const onFilterChange = vi.fn();
    renderPage(
      <LotsToolbar
        columnView={columnView}
        onFilterChange={onFilterChange}
        search={{ expiryTo: '2019-01-20' }}
      />,
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'lots.earliest-expiry' }));
    const calendar = await screen.findByRole('dialog');
    expect(
      await within(calendar).findByRole('button', { name: /January 21st, 2019/ }),
    ).toBeDisabled();
    await user.click(within(calendar).getByRole('button', { name: /January 10th, 2019/ }));

    expect(onFilterChange).toHaveBeenCalledWith({ expiryFrom: '2019-01-10', page: undefined });
  });
});
