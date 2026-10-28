import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it } from 'vitest';
import {
  RequisitionCommentDialog,
  useDraftComment,
} from '@/features/requisitions/components/requisition-comment-field';
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
  const draft = useDraftComment(editor);
  const [open, setOpen] = useState(true);
  return (
    <>
      <output aria-label="draft">{draft}</output>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <RequisitionCommentDialog
        editor={editor}
        open={open}
        pending={pending}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
const dialog = () => screen.findByRole('dialog');
const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

it('writes the comment only on Save and clears blank or removed comments', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  const input = within(await dialog()).getByRole('textbox', {
    name: 'requisitions.edit.comment-label',
  });
  expect(input).toHaveValue('ab');
  await user.clear(input);
  await user.type(input, 'replacement');
  expect(screen.getByLabelText('draft')).toHaveTextContent('ab');
  await user.click(screen.getByRole('button', { name: 'requisitions.edit.save-comment' }));
  await closed();
  expect(screen.getByLabelText('draft')).toHaveTextContent('replacement');

  await user.click(screen.getByRole('button', { name: 'open' }));
  const edit = within(await dialog()).getByRole('textbox');
  await user.clear(edit);
  await user.type(edit, '   ');
  await user.click(screen.getByRole('button', { name: 'requisitions.edit.save-comment' }));
  await closed();
  expect(screen.getByLabelText('draft')).toBeEmptyDOMElement();
});

it('removes an existing comment from the dialog without confirmation', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  await user.click(
    within(await dialog()).getByRole('button', { name: 'requisitions.edit.remove-comment' }),
  );
  await closed();
  expect(screen.getByLabelText('draft')).toBeEmptyDOMElement();
});

it('disables saving and removing during a pending action', async () => {
  render(<Editor pending />);
  const open = await dialog();
  expect(within(open).getByRole('textbox')).toBeDisabled();
  expect(
    within(open).getByRole('button', { name: 'requisitions.edit.save-comment' }),
  ).toBeDisabled();
  expect(
    within(open).getByRole('button', { name: 'requisitions.edit.remove-comment' }),
  ).toBeDisabled();
});
