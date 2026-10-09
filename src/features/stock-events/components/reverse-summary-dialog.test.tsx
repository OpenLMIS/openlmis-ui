import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ReverseSummaryDialog } from '@/features/stock-events/components/reverse-summary-dialog';

it('shows the saved balance and closes', async () => {
  const close = vi.fn();
  render(
    <ReverseSummaryDialog
      open
      onClose={close}
      unit="DOSES"
      unavailable={false}
      lines={[
        {
          orderable: { id: 'o', productCode: 'C1', fullProductName: 'Vaccine', netContent: 5 },
          lot: null,
          quantity: 20,
          stockOnHand: 50,
          occurredDate: '2026-10-01',
        },
      ]}
    />,
  );
  expect(screen.getByText('Vaccine (C1)')).toBeInTheDocument();
  expect(screen.getByText('50')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'stock-event-reverse.close' }));
  expect(close).toHaveBeenCalledOnce();
});
it('keeps an empty table with the failed read message', () => {
  render(<ReverseSummaryDialog open onClose={vi.fn()} unit="DOSES" unavailable lines={[]} />);
  expect(screen.getByText('stock-event-reverse.summary-unavailable')).toBeInTheDocument();
  expect(screen.getAllByRole('columnheader')).toHaveLength(5);
});
