import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { resolveColumnVisibility } from '@/components/data-table/responsive-columns';
import { productName } from '@/features/reference-data/lib/product-name';
import {
  INVENTORY_COLUMN_MIN_WIDTHS,
  INVENTORY_HIDEABLE_COLUMNS,
  inventoryHideableColumns,
  PhysicalInventoryGrid,
  PhysicalInventoryGridSkeleton,
} from '@/features/stock-events/components/physical-inventory-grid';
import { usePhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import {
  buildInventoryLines,
  inventoryPage,
} from '@/features/stock-events/lib/physical-inventory-lines';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: { field?: string }) =>
      key === 'stock-events.field-of' ? `${key}:${options?.field}` : key,
  }),
}));

vi.mock('@/features/reference-data/lib/product-name', async (original) => {
  const actual = await original<typeof import('@/features/reference-data/lib/product-name')>();
  return { ...actual, productName: vi.fn(actual.productName) };
});

const orderable = {
  id: 'p',
  productCode: 'P',
  fullProductName: 'Product',
  description: null,
  netContent: 10,
  programs: [{ programId: 'program', orderableCategoryDisplayName: 'Medicines' }],
};
const lines = buildInventoryLines(
  [
    { orderable, lot: null, stockOnHand: 5, stockCardId: 'c', active: true },
    {
      orderable,
      lot: { id: 'lot', lotCode: 'Batch', expirationDate: null },
      stockOnHand: 7,
      stockCardId: 'c2',
      active: true,
    },
  ],
  [
    { orderableId: 'p', quantity: 5 },
    { orderableId: 'p', lotId: 'lot', quantity: 7 },
  ],
);
describe('inventory grid', () => {
  it('uses No Lot Defined for a no-lot-only group', () => {
    render(
      <Grid
        bands={inventoryPage(lines.slice(0, 1), 'program').bands}
        visibility={{}}
        showVvm={false}
      />,
    );
    expect(screen.getByText('stock-events.no-lot-defined')).toBeInTheDocument();
  });
  it('shows a category band, product totals and individual lot rows', () => {
    render(<Grid bands={inventoryPage(lines, 'program').bands} visibility={{}} showVvm={false} />);
    expect(screen.getByText('Medicines')).toBeInTheDocument();
    const summary = screen.getByText('Product').closest('tr') as HTMLElement;
    expect(within(summary).getAllByText('12')).toHaveLength(2);
    expect(screen.getByText('Batch')).toBeInTheDocument();
    expect(screen.getByText('stock-events.no-lot-defined')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });
  it('hides optional columns and shows VVM when eligibility requires it', () => {
    render(
      <Grid
        bands={inventoryPage(lines, 'program').bands}
        visibility={{ productCode: false, packSize: false, expiry: false }}
        showVvm
      />,
    );
    expect(
      screen.queryByRole('columnheader', { name: 'stock-events.product-code' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'stock-events.vvm-status' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'physical-inventory.current-stock' }),
    ).toBeInTheDocument();
  });
});

function Grid(
  props: Omit<ComponentProps<typeof PhysicalInventoryGrid>, 'editor' | 'showActions'> & {
    unit?: 'DOSES' | 'PACKS';
    online?: boolean;
    showActions?: boolean;
    onDeactivate?: () => void;
    unchecked?: ReadonlySet<string>;
    onCounted?: (key: string) => void;
  },
) {
  const form = usePhysicalInventoryForm(
    props.bands.flatMap((band) => band.groups.flatMap((group) => group.lines)),
  );
  return (
    <PhysicalInventoryGrid
      {...props}
      showActions={props.showActions ?? false}
      editor={{
        form,
        unit: props.unit ?? 'DOSES',
        online: props.online ?? true,
        pending: false,
        validationAttempted: false,
        unchecked: props.unchecked ?? new Set(),
        onCounted: props.onCounted ?? vi.fn(),
        onReasons: vi.fn(),
        onEditLot: vi.fn(),
        onRemove: vi.fn(),
        onDeactivate: props.onDeactivate ?? vi.fn(),
      }}
    />
  );
}
it('uses packs for both summary totals and shows pack size on each lot', () => {
  render(
    <Grid
      bands={inventoryPage(lines, 'program').bands}
      visibility={{}}
      showVvm={false}
      unit="PACKS"
    />,
  );
  const summary = screen.getByText('Product').closest('tr') as HTMLElement;
  expect(within(summary).getAllByText('1 ( +2 )')).toHaveLength(2);
  expect(screen.getAllByText('10')).toHaveLength(3);
});

it('keeps offline Deactivate focusable with its tooltip while preventing activation', async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const onDeactivate = vi.fn();
  const zero = { ...lines[0], stockOnHand: 0, active: true };
  render(
    <Grid
      bands={inventoryPage([zero], 'program').bands}
      visibility={{}}
      showVvm={false}
      showActions
      online={false}
      onDeactivate={onDeactivate}
    />,
  );
  const action = screen.getByRole('button', {
    name: 'stock-events.field-of:physical-inventory.deactivate',
  });
  expect(action).toHaveAttribute('aria-disabled', 'true');
  await user.tab();
  await user.tab();
  await user.tab();
  expect(action).toHaveFocus();
  expect(await screen.findByText('physical-inventory.deactivate')).toBeInTheDocument();
  await user.keyboard('{Enter}');
  await user.click(action);
  await waitFor(() => expect(action).toHaveFocus());
  expect(onDeactivate).not.toHaveBeenCalled();
});

describe('inventory column priorities', () => {
  it.each(['DOSES', 'PACKS'] as const)(
    'hides optional columns before exceeding the 1600 px content budget with %s',
    (unit) => {
      const contentWidth = 1600 - 16 * 16 - 2 * 24;
      const columns = inventoryHideableColumns({ showVvm: true, showActions: true, unit });
      const visibility = resolveColumnVisibility(columns, {}, contentWidth);
      expect(visibility.productCode).toBe(false);
      expect(columns.find((column) => visibility[column.id])?.hideBelow).toBeLessThanOrEqual(
        contentWidth,
      );
      render(
        <Grid
          bands={inventoryPage(lines, 'program').bands}
          visibility={visibility}
          unit={unit}
          showVvm
          showActions
        />,
      );
      expect(screen.getAllByRole('columnheader')).toHaveLength(
        11 - Object.values(visibility).filter((visible) => !visible).length,
      );
    },
  );

  it('offers only the four lower-priority columns in View', () => {
    expect(INVENTORY_HIDEABLE_COLUMNS.map(({ id }) => id)).toEqual([
      'productCode',
      'packSize',
      'expiry',
      'stock',
    ]);
  });

  it('hides optional columns in priority order at the static minimum-width boundaries', () => {
    const columns = inventoryHideableColumns({ showVvm: true, showActions: true });
    const total = Object.values(INVENTORY_COLUMN_MIN_WIDTHS).reduce(
      (sum, { rem }) => sum + rem * 16 + 4,
      0,
    );
    let remaining = total;
    for (let removed = 0; removed < columns.length; removed++) {
      expect(columns[removed].hideBelow).toBe(remaining + 2);
      expect(resolveColumnVisibility(columns, {}, remaining + 2)[columns[removed].id]).toBe(true);
      const hidden = Object.entries(resolveColumnVisibility(columns, {}, remaining + 1))
        .filter(([, visible]) => !visible)
        .map(([id]) => id);
      expect(hidden).toEqual(columns.slice(0, removed + 1).map(({ id }) => id));
      remaining -= INVENTORY_COLUMN_MIN_WIDTHS[columns[removed].id].rem * 16 + 4;
    }
  });

  it('budgets VVM and Actions only when shown and reserves room for pack inputs', () => {
    const base = inventoryHideableColumns({ showVvm: false, showActions: false });
    const full = inventoryHideableColumns({ showVvm: true, showActions: true });
    expect(full[0].hideBelow - base[0].hideBelow).toBe(
      (INVENTORY_COLUMN_MIN_WIDTHS.vvm.rem + INVENTORY_COLUMN_MIN_WIDTHS.actions.rem) * 16 + 8,
    );
    const packs = inventoryHideableColumns({ showVvm: false, showActions: false, unit: 'PACKS' });
    expect(packs[0].hideBelow - base[0].hideBelow).toBe(2 * 16);
  });

  it('counts forced-visible columns, excludes forced-hidden columns and ignores stale choices', () => {
    const options = { showVvm: false, showActions: false };
    const base = inventoryHideableColumns(options);
    expect(inventoryHideableColumns(options, { product: false, lot: false })).toEqual(base);
    const forcedHidden = inventoryHideableColumns(options, { productCode: false });
    expect(forcedHidden[1].hideBelow).toBe(base[1].hideBelow);
    const forcedVisible = inventoryHideableColumns(options, { productCode: true });
    expect(forcedVisible[1].hideBelow).toBe(base[0].hideBelow);
    expect(resolveColumnVisibility(forcedVisible, { productCode: true }, 390)).toEqual({
      productCode: true,
      packSize: false,
      expiry: false,
      stock: false,
    });
    expect(Object.values(resolveColumnVisibility(base, {}, 390))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('keeps identifying and editing columns despite stale stored choices', () => {
    const visibility = {
      product: false,
      lot: false,
      count: false,
      reasons: false,
      unaccounted: false,
    };
    const props = { visibility, showVvm: false };
    const { unmount } = render(<Grid {...props} bands={inventoryPage(lines, 'program').bands} />);
    expect(screen.getByText('Batch')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    const headers = screen.getAllByRole('columnheader').map((head) => head.textContent);
    unmount();
    render(<PhysicalInventoryGridSkeleton {...props} />);
    expect(screen.getAllByRole('columnheader').map((head) => head.textContent)).toEqual(headers);
  });
});

it('marks the unaccounted cell, not the count, as soon as a count leaves a difference', async () => {
  const user = userEvent.setup();
  render(
    <Grid
      bands={inventoryPage(lines.slice(0, 1), 'program').bands}
      visibility={{}}
      showVvm={false}
    />,
  );
  const input = screen.getByRole('textbox');
  await user.clear(input);
  await user.type(input, '4');
  expect(input).not.toHaveAttribute('aria-invalid', 'true');
  const message = document.getElementById(input.getAttribute('aria-describedby') ?? '');
  expect(message).toHaveTextContent('physical-inventory.unaccounted-error');
  expect(message?.closest('.sr-only')).not.toBeNull();
  const cell = message?.closest('td') as HTMLElement;
  expect(cell).not.toBe(input.closest('td'));
  await user.clear(input);
  expect(input).not.toHaveAttribute('aria-describedby');
});

it('updates product totals through the group subscription with stable bands', async () => {
  const user = userEvent.setup();
  render(<Grid bands={inventoryPage(lines, 'program').bands} visibility={{}} showVvm={false} />);
  const input = screen.getAllByRole('textbox')[0];
  await user.clear(input);
  await user.type(input, '6');
  const summary = screen.getByText('Product').closest('tr') as HTMLElement;
  expect(within(summary).getByText('13')).toBeInTheDocument();
});

it('leaves another product summary subscribed only to its own rows during count entry', async () => {
  const user = userEvent.setup();
  const other = { ...orderable, id: 'other', productCode: 'Q', fullProductName: 'Other' };
  const others = lines.map((line) => ({ ...line, key: `other-${line.key}`, orderable: other }));
  render(
    <Grid
      bands={inventoryPage([...lines, ...others], 'program').bands}
      visibility={{}}
      showVvm={false}
    />,
  );
  vi.mocked(productName).mockClear();
  const input = screen.getAllByRole('textbox')[0];
  await user.clear(input);
  await user.type(input, '6');
  expect(vi.mocked(productName).mock.calls.some(([product]) => product.productCode === 'Q')).toBe(
    false,
  );
});

it('leaves missing pack sizes, expiry dates and stock quantities blank', () => {
  const blank = {
    ...lines[0],
    orderable: { ...orderable, netContent: undefined },
    stockOnHand: null,
  };
  render(<Grid bands={inventoryPage([blank], 'program').bands} visibility={{}} showVvm={false} />);
  expect(within(screen.getByRole('table')).queryByText('-')).not.toBeInTheDocument();
});

it('starts each reasons accessible name with its visible label', () => {
  render(<Grid bands={inventoryPage(lines, 'program').bands} visibility={{}} showVvm={false} />);
  for (const button of screen.getAllByRole('button', { name: /physical-inventory.reasons/ }))
    expect(button.getAttribute('aria-label')).toMatch(/^physical-inventory.add-reasons/);
});

it('opens the unaccounted tooltip when the count input receives keyboard focus', async () => {
  const user = userEvent.setup();
  const invalid = { ...lines[0], quantity: { doses: '4', packs: '0', remainder: '4' } };
  render(
    <Grid bands={inventoryPage([invalid], 'program').bands} visibility={{}} showVvm={false} />,
  );
  await user.tab();
  expect(screen.getByRole('textbox')).toHaveFocus();
  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    'physical-inventory.unaccounted-error',
  );
});

it.each([false, true])(
  'validates unaccounted quantity on count entry before Submit with justAdded=%s',
  async (justAdded) => {
    const user = userEvent.setup();
    const line = {
      ...lines[0],
      stockOnHand: 0,
      justAdded,
      isAdded: true,
      quantity: { doses: '', packs: '', remainder: '' },
    };
    render(<Grid bands={inventoryPage([line], 'program').bands} visibility={{}} showVvm={false} />);
    const input = screen.getByRole('textbox');
    await user.type(input, '1');
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'physical-inventory.unaccounted-error',
    );
    await user.clear(input);
    await user.type(input, '0');
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  },
);

it('shows editable phone cards with visible details and the existing line action', async () => {
  const user = userEvent.setup();
  const onDeactivate = vi.fn();
  const line = {
    ...lines[0],
    stockOnHand: 0,
    quantity: { doses: '0', packs: '0', remainder: '0' },
  };
  render(
    <Grid
      cards
      bands={inventoryPage([line], 'program').bands}
      visibility={{ expiry: false }}
      showVvm={false}
      showActions
      onDeactivate={onDeactivate}
    />,
  );
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  const card = screen.getByText('Product (P)').closest('li') as HTMLElement;
  expect(within(card).getByText('stock-events.no-lot-defined')).toBeInTheDocument();
  expect(within(card).getByText('stock-events.pack-size')).toBeInTheDocument();
  expect(within(card).queryByText('stock-events.expiry-date')).not.toBeInTheDocument();
  const input = within(card).getByRole('textbox');
  await user.clear(input);
  await user.type(input, '2');
  expect(input).toHaveValue('2');
  expect(within(card).getByRole('button', { name: /physical-inventory.reasons/ })).toBeEnabled();
  await user.click(
    within(card).getByRole('button', {
      name: 'stock-events.field-of:physical-inventory.deactivate',
    }),
  );
  expect(onDeactivate).toHaveBeenCalled();
});

it('groups phone lots under their category and product with live totals and empty VVM values', async () => {
  const user = userEvent.setup();
  const grouped = lines.map((line) => ({
    ...line,
    orderable: { ...line.orderable, dispensable: { displayUnit: 'tablet' } },
  }));
  render(
    <Grid
      cards
      bands={inventoryPage(grouped, 'program').bands}
      visibility={{}}
      showVvm
      unit="PACKS"
    />,
  );
  expect(screen.getByRole('heading', { name: 'Medicines' })).toBeInTheDocument();
  const card = screen.getByText('Product - tablet (P)').closest('li') as HTMLElement;
  expect(within(card).getByText('Batch')).toBeInTheDocument();
  expect(within(card).getByText('stock-events.no-lot-defined')).toBeInTheDocument();
  expect(within(card).getByText('physical-inventory.total')).toBeInTheDocument();
  expect(within(card).getAllByText('1 ( +2 )')).toHaveLength(2);
  const labels = within(card).getAllByText('stock-events.vvm-status');
  for (const label of labels)
    expect(
      within(label.closest('.justify-between') as HTMLElement).getByText('-', { exact: true }),
    ).toBeInTheDocument();
  const input = within(card).getAllByRole('textbox')[0];
  await user.clear(input);
  await user.type(input, '1');
  expect(within(card).getByText('2 ( +2 )')).toBeInTheDocument();
});
