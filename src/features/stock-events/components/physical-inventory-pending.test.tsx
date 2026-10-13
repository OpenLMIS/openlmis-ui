import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { WorkspaceSlots } from '@/components/workspace-tabs';
import {
  InventoryToolbar,
  PhysicalInventoryPendingBody,
} from '@/features/stock-events/components/physical-inventory-pending';
import type { InventorySearch } from '@/features/stock-events/lib/physical-inventory-search';
import type { SearchChange } from '@/lib/table-search';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

const quantityUnit = { unit: 'DOSES' as const, canSwitch: true, setUnit: vi.fn() };

it('counts live filters and keeps keyword history replacement and page resets', async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  function Toolbar() {
    const [search, setSearch] = useState<InventorySearch>({
      page: 3,
      size: undefined,
      keyword: undefined,
      includeInactive: undefined,
    });
    const onSearchChange: SearchChange<InventorySearch> = (patch, replace) => {
      change(patch, replace);
      setSearch((previous) => ({ ...previous, ...patch }));
    };
    return (
      <InventoryToolbar
        search={search}
        onSearchChange={onSearchChange}
        quantityUnit={quantityUnit}
        view={{ visibility: {}, onVisibilityChange: vi.fn(), onReset: vi.fn() }}
        progress={null}
        save={null}
      />
    );
  }
  render(<Toolbar />);
  const filter = screen.getByRole('button', { name: 'stock-on-hand.filter' });
  expect(within(filter).queryByText('1')).not.toBeInTheDocument();
  await user.click(filter);
  const keyword = screen.getByRole('textbox', { name: 'stock-events.keywords' });
  expect(keyword).toHaveAttribute('placeholder', 'stock-events.keywords');
  await user.type(keyword, 'A');
  expect(change).toHaveBeenLastCalledWith({ keyword: 'A', page: undefined }, true);
  expect(within(filter).getByText('1')).toHaveAttribute('aria-hidden', 'true');
  expect(filter).toHaveAccessibleName('stock-on-hand.filter stock-on-hand.active-filters:1');
  await user.click(screen.getByRole('switch', { name: 'physical-inventory.include-inactive' }));
  expect(change).toHaveBeenLastCalledWith({ includeInactive: true, page: undefined }, undefined);
  expect(within(filter).getByText('2')).toBeInTheDocument();
  await user.clear(keyword);
  expect(change).toHaveBeenLastCalledWith({ keyword: undefined, page: undefined }, true);
  expect(within(filter).getByText('1')).toBeInTheDocument();
  await user.click(screen.getByRole('switch', { name: 'physical-inventory.include-inactive' }));
  expect(within(filter).queryByText('1')).not.toBeInTheDocument();
});

it('keeps loading controls and footer actions disabled with the chosen grid columns', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WorkspaceSlots>
        <PhysicalInventoryPendingBody
          search={{ keyword: 'A', page: undefined, size: undefined, includeInactive: undefined }}
          quantityUnit={quantityUnit}
          visibility={{ productCode: false, packSize: false, expiry: false, stock: false }}
          showVvm
          showActions
        />
      </WorkspaceSlots>
    </QueryClientProvider>,
  );
  for (const name of [
    'physical-inventory.delete',
    'physical-inventory.save',
    'stock-events.submit',
    'physical-inventory.add-product',
    'View',
  ]) {
    expect(screen.getByRole('button', { name })).toBeDisabled();
  }
  expect(screen.getByRole('button', { name: /stock-on-hand.filter/ })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'quantity-unit.packs' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
  expect(
    screen.queryByRole('columnheader', { name: 'stock-events.product-code' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'stock-events.vvm-status' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'stock-events.actions' })).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: 'physical-inventory.add-reasons' })[0],
  ).toBeDisabled();
});
