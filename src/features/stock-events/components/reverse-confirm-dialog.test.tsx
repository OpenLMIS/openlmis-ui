import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import { ReverseConfirmDialog } from '@/features/stock-events/components/reverse-confirm-dialog';
import type { StockEventLine } from '@/features/stock-events/lib/types';

vi.mock('@/components/data-table/responsive-columns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/data-table/responsive-columns')>()),
  useElementWidth: vi.fn(),
}));

const line: StockEventLine = {
  stockEventLineItemId: 'line',
  orderable: { id: 'o', productCode: 'C1', fullProductName: 'Vaccine', netContent: 5 },
  lot: null,
  quantity: 20,
  stockOnHand: 10,
  occurredDate: '2026-10-01',
};
it('shows the picked reason, comments and current and resulting balances before confirmation', async () => {
  const confirm = vi.fn();
  vi.mocked(useElementWidth).mockReturnValue([vi.fn(), 944]);
  render(
    <ReverseConfirmDialog
      open
      onOpenChange={vi.fn()}
      onConfirm={confirm}
      unit="DOSES"
      rows={[{ id: 'line', line, reasonId: 'cancel', comments: 'Mistake' }]}
      reasons={[
        {
          id: 'cancel',
          name: 'Cancelled issue',
          reasonType: 'CREDIT',
          reasonCategory: 'ADJUSTMENT',
          tags: [],
          isFreeTextAllowed: true,
        },
      ]}
      current={{ 'o/': 30 }}
      balances={{ line: 50 }}
    />,
  );
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('cell', { name: 'Vaccine (C1)' })).toBeInTheDocument();
  expect(
    within(dialog).getByRole('cell', { name: 'Cancelled issue: Mistake' }),
  ).toBeInTheDocument();
  expect(within(dialog).getByRole('cell', { name: '30' })).toBeInTheDocument();
  expect(within(dialog).getByRole('cell', { name: '50' })).toBeInTheDocument();
  expect(
    within(dialog).getByRole('columnheader', { name: 'stock-event-reverse.new-stock-on-hand' }),
  ).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: 'stock-events.confirm' }));
  expect(confirm).toHaveBeenCalledOnce();
});
