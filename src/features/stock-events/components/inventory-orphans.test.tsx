import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { InventoryOrphans } from '@/features/stock-events/components/inventory-orphans';
import {
  clearInventoryLocal,
  readInventoryScope,
} from '@/features/stock-events/lib/physical-inventory-local';

vi.mock('@/features/stock-events/lib/physical-inventory-local', () => ({
  readInventoryScope: vi.fn(),
  clearInventoryLocal: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
it('requires confirmation and reports a failed orphan discard without losing the copy', async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'orphan-discard', username: 'Ada', accessToken: 'token' });
  vi.mocked(readInventoryScope).mockResolvedValue([
    {
      draftId: 'old',
      facilityId: 'f',
      programId: 'p',
      lines: [],
      modified: true,
      orphaned: true,
      savedAt: 1,
    },
  ]);
  vi.mocked(clearInventoryLocal).mockRejectedValue(new Error('Unavailable'));
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <InventoryOrphans scope={{ facilityId: 'f', programId: 'p' }} />
    </QueryClientProvider>,
  );
  await user.click(await screen.findByRole('button', { name: 'physical-inventory.discard-copy' }));
  expect(clearInventoryLocal).not.toHaveBeenCalled();
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'physical-inventory.discard-copy',
    }),
  );
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('physical-inventory.copy-error-title', {
      description: 'physical-inventory.copy-error-description',
    }),
  );
  expect(clearInventoryLocal).toHaveBeenCalledWith('old', 0, expect.any(Number), expect.anything());
  expect(screen.getByText('physical-inventory.orphaned-counts')).toBeInTheDocument();
});
