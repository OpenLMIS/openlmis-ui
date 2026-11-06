import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { RequisitionEditor } from '@/features/requisitions/hooks/use-requisition-form';
import { RequisitionCopyContext, RequisitionCopyNotice } from './requisition-copy-notice';
import { RequisitionDraftStatus } from './requisition-draft-status';

const state = vi.hoisted(() => ({
  online: true,
  copies: [] as { id: string; fetchedAt: number }[],
}));
vi.mock('@/hooks/use-leave-guard', () => ({ allowUnload: vi.fn(), whenLeaveAllowed: vi.fn() }));
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useRouter: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@/features/requisitions/hooks/use-offline-copies', () => ({
  useOfflineCopies: () => state.copies,
}));
vi.mock('@/lib/online', () => ({ useOnline: () => state.online }));
afterEach(() => {
  cleanup();
  state.online = true;
  state.copies = [];
});
it('forgets a previous batch identity when the remaining copy was never saved', () => {
  state.copies = [{ id: 'a', fetchedAt: 1 }];
  const { rerender } = render(<RequisitionCopyNotice id="a" representation="batch" />);
  state.copies = [];
  rerender(<RequisitionCopyNotice id="b" representation="batch" />);
  expect(screen.queryByText('requisitions.offline.removed-title')).not.toBeInTheDocument();
});

it('replaces a pending copy badge with failure status while keeping retry reachable', async () => {
  let finish!: (error: unknown) => void;
  const result = new Promise<unknown>((resolve) => {
    finish = resolve;
  });
  render(
    <>
      <RequisitionCopyNotice id="a" result={result} badge />
      <RequisitionCopyNotice id="a" result={result} />
    </>,
  );
  expect(screen.getByText('requisitions.offline.preparing-label')).toBeVisible();
  await act(() => finish(new Error('Storage unavailable')));
  expect(screen.getAllByText('requisitions.offline.unavailable-label')[0]).toBeVisible();
  expect(screen.getByRole('button', { name: 'error.try-again' })).toBeEnabled();
});

it('shows one online device status while a copy prepares or fails after draft persistence', async () => {
  const capture = Promise.withResolvers<unknown>();
  const saved = { status: 'saved' as const };
  const editor = {
    device: { subscribeStatus: () => () => {}, getStatus: () => saved },
  } as unknown as RequisitionEditor;
  render(
    <RequisitionCopyContext value={{ id: 'a', result: capture.promise }}>
      <RequisitionDraftStatus editor={editor} />
      <RequisitionCopyNotice id="a" result={capture.promise} />
    </RequisitionCopyContext>,
  );
  expect(screen.getByText('requisitions.offline.preparing-label')).toBeVisible();
  expect(screen.queryByText('stock-events.draft-saved')).not.toBeInTheDocument();
  await act(() => capture.resolve(new Error('Reference data incomplete')));
  expect(screen.getByText('requisitions.offline.unavailable-description')).toBeVisible();
  expect(screen.queryByText('stock-events.draft-saved')).not.toBeInTheDocument();
  expect(screen.queryByText('requisitions.offline.failed-title')).not.toBeInTheDocument();
});
