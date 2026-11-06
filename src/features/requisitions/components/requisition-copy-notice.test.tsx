import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RequisitionCopyNotice } from './requisition-copy-notice';

const state = vi.hoisted(() => ({ copies: [] as { id: string; fetchedAt: number }[] }));
vi.mock('@/hooks/use-leave-guard', () => ({ allowUnload: vi.fn(), whenLeaveAllowed: vi.fn() }));
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useRouter: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@/features/requisitions/hooks/use-offline-copies', () => ({
  useOfflineCopies: () => state.copies,
}));
afterEach(cleanup);
it('forgets a previous batch identity when the remaining copy was never saved', () => {
  state.copies = [{ id: 'a', fetchedAt: 1 }];
  const { rerender } = render(<RequisitionCopyNotice id="a" representation="batch" />);
  state.copies = [];
  rerender(<RequisitionCopyNotice id="b" representation="batch" />);
  expect(screen.queryByText('requisitions.offline.removed-title')).not.toBeInTheDocument();
});
