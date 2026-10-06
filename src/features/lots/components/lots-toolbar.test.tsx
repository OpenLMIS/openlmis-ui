import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LotsToolbar } from '@/features/lots/components/lots-toolbar';
import type { LotsSearch } from '@/features/lots/lib/search';
import { fetchOrderables, fetchOrderablesByIds } from '@/features/reference-data/api/api';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/reference-data/api/api', () => ({
  ORDERABLE_SEARCH_SIZE: 20,
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

  it('tells the user to type, since only the first products are listed', async () => {
    vi.mocked(fetchOrderables).mockImplementation(async ({ name }) => ({
      content: [acid],
      totalElements: name ? 45 : 10233,
      totalPages: 1,
      number: 0,
      size: 20,
    }));
    renderPage(<LotsToolbar columnView={columnView} onFilterChange={vi.fn()} search={{}} />);
    const user = userEvent.setup();

    const product = await screen.findByRole('combobox', { name: 'lots.product' });
    await user.click(product);
    expect(await screen.findByText('lots.search-hint')).toBeInTheDocument();

    await user.type(product, 'a');
    expect(await screen.findByText('lots.search-more')).toBeInTheDocument();
  });

  it('filters by a product found on the server, back on the first page', async () => {
    const onFilterChange = vi.fn();
    renderPage(
      <LotsToolbar columnView={columnView} onFilterChange={onFilterChange} search={{ page: 2 }} />,
    );
    const user = userEvent.setup();

    await user.type(await screen.findByRole('combobox', { name: 'lots.product' }), 'acid');
    await waitFor(() => expect(fetchOrderables).toHaveBeenCalledWith({ name: 'acid', code: '' }));
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

  it('lists products afresh when reopened after a pick, not just the picked one', async () => {
    function Toolbar() {
      const [search, setSearch] = useState<LotsSearch>({});
      return (
        <LotsToolbar
          columnView={columnView}
          onFilterChange={(patch) => setSearch((previous) => ({ ...previous, ...patch }))}
          search={search}
        />
      );
    }
    renderPage(<Toolbar />);
    const user = userEvent.setup();

    const product = await screen.findByRole('combobox', { name: 'lots.product' });
    await user.click(product);
    await user.click(await screen.findByRole('option', { name: /Acetylsalicylic Acid/ }));
    await waitFor(() => expect(product).toHaveValue('Acetylsalicylic Acid'));
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fetchOrderables).not.toHaveBeenCalledWith({ name: 'Acetylsalicylic Acid', code: '' });
  });

  it('keeps a pick named once the search moves on, while its lookup is still out', async () => {
    const other = { ...acid, id: 'o2', productCode: 'C2', fullProductName: 'Glibenclamide' };
    vi.mocked(fetchOrderables).mockImplementation(async ({ name }) => ({
      content: name ? [acid] : [other],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    }));
    vi.mocked(fetchOrderablesByIds).mockReturnValue(new Promise(() => {}));
    function Toolbar() {
      const [search, setSearch] = useState<LotsSearch>({});
      return (
        <LotsToolbar
          columnView={columnView}
          onFilterChange={(patch) => setSearch((previous) => ({ ...previous, ...patch }))}
          search={search}
        />
      );
    }
    renderPage(<Toolbar />);
    const user = userEvent.setup();

    const product = await screen.findByRole('combobox', { name: 'lots.product' });
    await user.type(product, 'acid');
    await user.click(await screen.findByRole('option', { name: /Acetylsalicylic Acid/ }));
    await waitFor(() => expect(fetchOrderables).toHaveBeenLastCalledWith({ name: '', code: '' }));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(product).toHaveValue('Acetylsalicylic Acid');
    expect(screen.getByRole('button', { name: /Clear/ })).toBeInTheDocument();
  });

  it('shows no made-up name while a linked product is still being looked up', async () => {
    vi.mocked(fetchOrderablesByIds).mockReturnValue(new Promise(() => {}));
    renderPage(
      <LotsToolbar
        columnView={columnView}
        onFilterChange={vi.fn()}
        search={{ product: acid.id }}
      />,
    );

    const product = await screen.findByRole('combobox', { name: 'lots.product' });
    expect(product).toHaveValue('');
  });

  it('says the product is unknown when the lookup finds none', async () => {
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([]);
    renderPage(
      <LotsToolbar
        columnView={columnView}
        onFilterChange={vi.fn()}
        search={{ product: acid.id }}
      />,
    );

    expect(await screen.findByDisplayValue('lots.unknown-product')).toBeInTheDocument();
  });

  it('keeps naming each expiry date once it is picked', async () => {
    renderPage(
      <LotsToolbar
        columnView={columnView}
        onFilterChange={vi.fn()}
        search={{ expiryFrom: '2019-01-10', expiryTo: '2019-01-20' }}
      />,
    );

    expect(await screen.findByRole('button', { name: /^lots.earliest-expiry/ })).toHaveTextContent(
      'lots.earliest-expiry',
    );
    expect(screen.getByRole('button', { name: /^lots.latest-expiry/ })).toHaveTextContent(
      'lots.latest-expiry',
    );
  });
});
