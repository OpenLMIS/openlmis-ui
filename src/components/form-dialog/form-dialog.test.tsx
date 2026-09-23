import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
} from '@/components/form-dialog/form-dialog';

function renderDialog({ pending = false } = {}) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();
  render(
    <FormDialog onOpenChange={onOpenChange} open>
      <FormDialogForm onSubmit={onSubmit}>
        <FormDialogHeader description="Details" title="Edit" />
        <FormDialogBody>
          <input aria-label="Name" />
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel disabled={pending}>Cancel</FormDialogCancel>
          <FormDialogSubmit pending={pending}>Save</FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
    </FormDialog>,
  );
  return { onOpenChange, onSubmit };
}

describe('FormDialog', () => {
  it('submits on the button and on Enter', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('closes from Cancel', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('locks both buttons while saving', () => {
    renderDialog({ pending: true });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
