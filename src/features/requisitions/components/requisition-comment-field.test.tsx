import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { useRequisitionComment } from '@/features/requisitions/components/requisition-comment-field';
import { useRequisitionForm } from '@/features/requisitions/hooks/use-requisition-form';
import { record } from '@/features/requisitions/lib/fixtures/builders';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

const value: RequisitionRecord = {
  ...record(),
  requisitionLineItems: [],
  id: 'r',
  facility: { id: 'f' },
  processingPeriod: { id: 'p' },
  draftStatusMessage: 'ab',
};
function Editor({ pending = false }: { pending?: boolean }) {
  const editor = useRequisitionForm(value);
  const comment = useRequisitionComment(editor, pending);
  return (
    <>
      {comment.action}
      {comment.field}
    </>
  );
}
it('keeps the comment box and focus when its existing text is cleared until Remove Comment', async () => {
  render(<Editor />);
  const input = screen.getByRole('textbox', { name: 'requisitions.edit.comment-label' });
  await userEvent.clear(input);
  expect(input).toBeInTheDocument();
  expect(input).toHaveFocus();
  await userEvent.type(input, 'replacement');
  expect(input).toHaveValue('replacement');
  await userEvent.click(screen.getByRole('button', { name: 'requisitions.edit.remove-comment' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
it('retains the comment box disabled during a pending action', () => {
  const { rerender } = render(<Editor />);
  const input = screen.getByRole('textbox');
  rerender(<Editor pending />);
  expect(screen.getByRole('textbox')).toBe(input);
  expect(input).toBeDisabled();
  expect(screen.getByRole('button', { name: 'requisitions.edit.remove-comment' })).toBeDisabled();
});
