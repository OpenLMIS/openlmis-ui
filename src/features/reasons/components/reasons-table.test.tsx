import { QueryClient } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { Suspense } from 'react';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReasonsTable } from '@/features/reasons/components/reasons-table';
import { CLEARED_REASON_FILTERS, type ReasonsSearch } from '@/features/reasons/lib/search';
import { fetchReasons } from '@/features/reference-data/api/api';
import type { Reason } from '@/features/reference-data/lib/types';
import { renderPage } from '@/tests/render-page';
import en from '../../../../public/locales/en.json';

vi.mock('@/features/reference-data/api/api', () => ({ fetchReasons: vi.fn() }));

const reason = (
  id: string,
  name: string,
  reasonType: string,
  reasonCategory: string,
  isFreeTextAllowed = false,
): Reason => ({ id, name, reasonType, reasonCategory, isFreeTextAllowed, tags: [] });

function renderTable(
  reasons: Reason[],
  {
    search = {},
    columnVisibility = {},
  }: { search?: ReasonsSearch; columnVisibility?: Record<string, boolean> } = {},
) {
  vi.mocked(fetchReasons).mockResolvedValue(reasons);
  const onSearchChange = vi.fn();
  renderPage(
    <Suspense>
      <ReasonsTable
        columnVisibility={columnVisibility}
        onSearchChange={onSearchChange}
        search={search}
      />
    </Suspense>,
    { queryClient: new QueryClient() },
  );
  return { onSearchChange };
}

beforeAll(async () => {
  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ReasonsTable', () => {
  it('shows each category and type in words, and a code it has no words for as it is', async () => {
    renderTable([
      reason('r1', 'Transfer In', 'CREDIT', 'TRANSFER', true),
      reason('r2', 'Unpack Kit', 'DEBIT', 'AGGREGATION'),
      reason('r3', 'Odd One', 'NEW_TYPE', 'NEW_CATEGORY'),
    ]);

    const transfer = (await screen.findByText('Transfer In')).closest('tr') as HTMLElement;
    expect(within(transfer).getByText('Transfer')).toBeVisible();
    expect(within(transfer).getByText('Credit')).toBeVisible();
    expect(within(transfer).getByText('Yes')).toBeVisible();
    const unpack = screen.getByText('Unpack Kit').closest('tr') as HTMLElement;
    expect(within(unpack).getByText('Aggregation')).toBeVisible();
    expect(within(unpack).getByText('No')).toBeVisible();
    const odd = screen.getByText('Odd One').closest('tr') as HTMLElement;
    expect(within(odd).getByText('NEW_CATEGORY')).toBeVisible();
    expect(within(odd).getByText('NEW_TYPE')).toBeVisible();
  });

  it('lists the reasons by name, filtered by the search', async () => {
    renderTable(
      [
        reason('r1', 'Transfer In', 'CREDIT', 'TRANSFER'),
        reason('r2', 'Damage', 'DEBIT', 'ADJUSTMENT'),
        reason('r3', 'Transfer Out', 'DEBIT', 'TRANSFER'),
      ],
      { search: { q: 'transfer' } },
    );

    await screen.findByText('Transfer In');
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('td')?.textContent);
    expect(names).toEqual(['Transfer In', 'Transfer Out']);
  });

  it('puts the type and category under the name when their columns are hidden', async () => {
    renderTable([reason('r1', 'Damage', 'DEBIT', 'ADJUSTMENT')], {
      columnVisibility: { category: false, type: false },
    });

    const row = (await screen.findByText('Damage')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Debit · Adjustment')).toBeVisible();
  });

  it('opens a reason from its row menu, on its own page', async () => {
    renderTable([reason('r1', 'Damage', 'DEBIT', 'ADJUSTMENT')]);

    await userEvent.click(await screen.findByRole('button', { name: 'Actions For Damage' }));
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/administration/reasons/r1',
    );
  });

  it('says when there are no reasons at all', async () => {
    renderTable([]);

    expect(await screen.findByText('No Reasons Yet')).toBeVisible();
  });

  it('offers to clear a search that matches nothing', async () => {
    const { onSearchChange } = renderTable([reason('r1', 'Damage', 'DEBIT', 'ADJUSTMENT')], {
      search: { q: 'zzz' },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Clear Search' }));
    expect(onSearchChange).toHaveBeenCalledWith(CLEARED_REASON_FILTERS);
  });

  it('goes back to the last page when the page asked for is past the end', async () => {
    const { onSearchChange } = renderTable([reason('r1', 'Damage', 'DEBIT', 'ADJUSTMENT')], {
      search: { page: 4 },
    });

    await screen.findByRole('table');
    await vi.waitFor(() => expect(onSearchChange).toHaveBeenCalledWith({ page: undefined }, true));
  });
});
