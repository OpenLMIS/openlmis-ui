import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateValue } from '@/components/form/date-value';
import { fetchLotRows } from '@/features/lots/api/api';
import { LotsTable } from '@/features/lots/components/lots-table';
import type { LotRow } from '@/features/lots/lib/types';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/lots/api/api', () => ({ fetchLotRows: vi.fn() }));

const row = (overrides: Partial<LotRow> = {}): LotRow => ({
  id: 'l1',
  lotCode: 'LC2017A',
  active: true,
  tradeItemId: 't1',
  expirationDate: '2019-01-30',
  manufactureDate: '2017-01-30',
  product: {
    id: 'c1',
    productCode: 'C1',
    fullProductName: 'Acetylsalicylic Acid',
    description: null,
  },
  ...overrides,
});

const page = (content: LotRow[], totalElements = content.length) => ({
  content,
  totalElements,
  totalPages: Math.ceil(totalElements / 10),
  number: 0,
  size: 10,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('LotsTable', () => {
  it('shows each lot with its product and its dates in the page language', async () => {
    vi.mocked(fetchLotRows).mockResolvedValue(page([row()]));
    renderPage(
      <LotsTable columnVisibility={{}} onEdit={vi.fn()} onSearchChange={vi.fn()} search={{}} />,
    );

    const cells = within(await screen.findByRole('row', { name: /LC2017A/ }));
    expect(cells.getByText('C1')).toBeInTheDocument();
    expect(cells.getByText('Acetylsalicylic Acid')).toBeInTheDocument();
    expect(cells.getByText(formatDateValue('2019-01-30', 'en'))).toBeInTheDocument();
    expect(cells.getByText(formatDateValue('2017-01-30', 'en'))).toBeInTheDocument();
  });

  it('says when no product has the lot', async () => {
    vi.mocked(fetchLotRows).mockResolvedValue(page([row({ product: null })]));
    renderPage(
      <LotsTable columnVisibility={{}} onEdit={vi.fn()} onSearchChange={vi.fn()} search={{}} />,
    );

    expect(await screen.findByText('lots.no-product')).toBeInTheDocument();
  });

  it('opens a lot from its row menu', async () => {
    vi.mocked(fetchLotRows).mockResolvedValue(page([row()]));
    const onEdit = vi.fn();
    renderPage(
      <LotsTable columnVisibility={{}} onEdit={onEdit} onSearchChange={vi.fn()} search={{}} />,
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'lots.actions-for' }));
    await user.click(await screen.findByRole('menuitem', { name: 'lots.edit' }));

    expect(onEdit).toHaveBeenCalledWith('l1');
  });

  it('offers to clear the filters when nothing matches them', async () => {
    vi.mocked(fetchLotRows).mockResolvedValue(page([]));
    const onSearchChange = vi.fn();
    renderPage(
      <LotsTable
        columnVisibility={{}}
        onEdit={vi.fn()}
        onSearchChange={onSearchChange}
        search={{ expiryFrom: '2030-01-01' }}
      />,
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'lots.clear-filters' }));

    expect(onSearchChange).toHaveBeenCalledWith({
      product: undefined,
      expiryFrom: undefined,
      expiryTo: undefined,
      page: undefined,
    });
  });

  it('says there are no lots yet when nothing is filtered', async () => {
    vi.mocked(fetchLotRows).mockResolvedValue(page([]));
    renderPage(
      <LotsTable columnVisibility={{}} onEdit={vi.fn()} onSearchChange={vi.fn()} search={{}} />,
    );

    expect(await screen.findByText('lots.empty-title')).toBeInTheDocument();
  });
});
