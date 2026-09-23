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
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';

function renderDialog({ pending = false } = {}) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();
  render(
    <FormDialog onOpenChange={onOpenChange} open>
      <FormDialogForm onSubmit={onSubmit}>
        <FormDialogHeader>
          <FormDialogTitle>Edit</FormDialogTitle>
        </FormDialogHeader>
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
  it('submits from the button', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('submits on Enter in a field', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada{Enter}');

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('names the dialog by its title', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Edit' })).toBeInTheDocument();
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
