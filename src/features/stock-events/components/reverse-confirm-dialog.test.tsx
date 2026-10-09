import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ReverseConfirmDialog } from '@/features/stock-events/components/reverse-confirm-dialog';
import type { StockEventLine } from '@/features/stock-events/lib/types';

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
  render(
    <ReverseConfirmDialog
      open
      onOpenChange={vi.fn()}
      onConfirm={confirm}
      unit="DOSES"
      rows={[{ line, reasonId: 'cancel', comments: 'Mistake' }]}
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
  expect(within(dialog).getByText('Vaccine (C1)')).toBeInTheDocument();
  expect(within(dialog).getByText('Cancelled issue: Mistake')).toBeInTheDocument();
  expect(within(dialog).getByText('30')).toBeInTheDocument();
  expect(within(dialog).getByText('50')).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: 'stock-events.confirm' }));
  expect(confirm).toHaveBeenCalledOnce();
});
