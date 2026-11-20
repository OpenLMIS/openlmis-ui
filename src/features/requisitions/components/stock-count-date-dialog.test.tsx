import { act, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import {
  StockCountDateDialog,
  stockCountDateSchema,
} from '@/features/requisitions/components/stock-count-date-dialog';

import { renderPage } from '@/test-utils/render-page';

it('requires a real stock count date no later than today', () => {
  const schema = stockCountDateSchema('2026-10-28');
  expect(schema.safeParse({ date: '31/02/2026' }).error?.issues[0]?.message).toBe(
    'form.date-invalid',
  );
  for (const date of ['', '2026-10-29', '2026-02-30']) {
    expect(schema.safeParse({ date }).success).toBe(false);
  }
  expect(schema.safeParse({ date: '2026-10-28' }).success).toBe(true);
  expect(schema.safeParse({ date: '2026-10-01' }).success).toBe(true);
});

it('focuses the date on open without opening its calendar', async () => {
  await import('@/components/ui/calendar');
  await act(async () => {
    renderPage(
      <StockCountDateDialog
        action="submit"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        today="2026-10-28"
      />,
    );
  });

  const date = await screen.findByRole('textbox', { name: /requisitions.edit.stock-count-date/ });
  await waitFor(() => expect(date).toHaveFocus());
  expect(
    screen.queryByRole('dialog', { name: 'requisitions.edit.stock-count-date' }),
  ).not.toBeInTheDocument();
});
