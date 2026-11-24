import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { RequisitionMergeDialog } from '@/features/requisitions/components/requisition-merge-dialog';
import { record } from '@/features/requisitions/lib/fixtures/builders';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { DraftConflictError } from '@/lib/draft-store';
import { httpError } from '@/test-utils/http-error';

afterEach(cleanup);
it('requires a field choice and does not resolve when closed', async () => {
  const user = userEvent.setup();
  const onResolve = vi.fn(async () => undefined);
  const onClose = vi.fn();
  render(
    <RequisitionMergeDialog
      record={record() as RequisitionRecord}
      lineLabels={{}}
      conflicts={[{ path: 'draftStatusMessage', yours: 'Mine', server: 'Theirs' }]}
      onResolve={onResolve}
      onClose={onClose}
    />,
  );
  expect(screen.getByRole('button', { name: 'requisitions.merge.recover' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'dialog.close' }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onResolve).not.toHaveBeenCalled();
  await user.click(screen.getByRole('radio', { name: 'requisitions.merge.yours-value' }));
  await user.click(screen.getByRole('button', { name: 'requisitions.merge.recover' }));
  expect(onResolve).toHaveBeenCalledWith({ draftStatusMessage: 'yours' });
});

it.each([
  [
    httpError(400, {
      messageKey: 'requisition.error.sync.refused',
      message: 'Server refused recovery',
    }),
    'Server refused recovery',
  ],
  [new DraftConflictError(undefined), 'error.description'],
])(
  'clears a recovery failure while retrying the selected field choices: %s',
  async (error, description) => {
    const user = userEvent.setup();
    const retry = Promise.withResolvers<void>();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onResolve = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockImplementationOnce(() => retry.promise);
    render(
      <RequisitionMergeDialog
        record={record() as RequisitionRecord}
        lineLabels={{}}
        conflicts={[{ path: 'draftStatusMessage', yours: 'Mine', server: 'Theirs' }]}
        onResolve={onResolve}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('radio', { name: 'requisitions.merge.yours-value' }));
    await user.click(screen.getByRole('button', { name: 'requisitions.merge.recover' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(description);
    expect(log).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'requisitions.merge.recover' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await act(() => retry.resolve());
  },
);
