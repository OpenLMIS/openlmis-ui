import { render, screen, waitFor } from '@testing-library/react';
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
  const onSubmit = vi.fn();
  render(
    <FormDialog onOpenChange={vi.fn()} open>
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
  return { onSubmit };
}

describe('FormDialog', () => {
  it('submits from the button', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('locks both buttons while saving', () => {
    renderDialog({ pending: true });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

describe('FormDialogForm', () => {
  it('takes focus to its first field when it replaces a loading placeholder that had it', async () => {
    const { rerender } = render(
      <FormDialog onOpenChange={vi.fn()} open>
        <FormDialogFooter>
          <FormDialogCancel>Cancel</FormDialogCancel>
        </FormDialogFooter>
      </FormDialog>,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());

    rerender(
      <FormDialog onOpenChange={vi.fn()} open>
        <FormDialogForm onSubmit={vi.fn()}>
          <FormDialogBody>
            <input aria-label="Name" />
          </FormDialogBody>
        </FormDialogForm>
      </FormDialog>,
    );

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus());
  });
});
