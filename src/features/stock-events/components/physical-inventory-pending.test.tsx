import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
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

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
});

const quantityUnit = { unit: 'DOSES' as const, canSwitch: true, setUnit: vi.fn() };

it('keeps keyword history replacement and page resets, clearing both filters', async () => {
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
  await user.click(screen.getByRole('button', { name: /^Filters/ }));
  const keyword = await screen.findByRole('textbox', { name: 'stock-events.keywords' });
  expect(keyword).toHaveAttribute('maxLength', '50');
  await user.type(keyword, 'A');
  await waitFor(() =>
    expect(change).toHaveBeenLastCalledWith({ keyword: 'A', page: undefined }, true),
  );
  await user.click(
    await screen.findByRole('switch', { name: 'physical-inventory.include-inactive' }),
  );
  expect(change).toHaveBeenLastCalledWith({ includeInactive: true, page: undefined }, undefined);
  await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
  expect(change).toHaveBeenLastCalledWith(
    { keyword: undefined, includeInactive: undefined, page: undefined },
    undefined,
  );
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
  const filters = screen.getByRole('button', { name: /^Filters/ });
  expect(filters).toBeDisabled();
  expect(filters).toHaveTextContent('1');
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

it('uses phone skeleton cards with visible details and control-sized placeholders', () => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(390);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={client}>
      <WorkspaceSlots>
        <PhysicalInventoryPendingBody
          search={{
            page: undefined,
            size: undefined,
            keyword: undefined,
            includeInactive: undefined,
          }}
          quantityUnit={quantityUnit}
          showVvm
          showActions
        />
      </WorkspaceSlots>
    </QueryClientProvider>,
  );
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(6);
  expect(screen.getAllByText('stock-events.pack-size')).toHaveLength(5);
  expect(screen.getAllByText('stock-events.vvm-status')).toHaveLength(5);
  expect(screen.getByRole('button', { name: 'View' })).toBeDisabled();
  expect(container.querySelectorAll('li .h-7')).toHaveLength(15);
  expect(container.querySelector('.w-16')).toBeInTheDocument();
});
