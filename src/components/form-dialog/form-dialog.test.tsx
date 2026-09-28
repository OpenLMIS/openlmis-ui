import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
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
  it('keeps focus off a loading placeholder, then takes it to the first field', async () => {
    const { rerender } = render(
      <FormDialog onOpenChange={vi.fn()} open>
        <FormDialogFooter>
          <FormDialogCancel>Cancel</FormDialogCancel>
        </FormDialogFooter>
      </FormDialog>,
    );
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());

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

/** Like Base UI's radio group, which makes its checked item tabbable only after it mounts. */
function LateTabbableRadio() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    // biome-ignore lint/a11y/useSemanticElements: mirrors Base UI's radio, a span with the radio role.
    <span
      aria-checked="true"
      aria-label="Send Reset Email"
      role="radio"
      tabIndex={ready ? 0 : -1}
    />
  );
}

function OpenedByClick({ loaded = true }: { loaded?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Open
      </button>
      <FormDialog onOpenChange={setOpen} open={open}>
        {loaded ? (
          <FormDialogForm onSubmit={vi.fn()}>
            <FormDialogBody>
              <LateTabbableRadio />
            </FormDialogBody>
            <FormDialogFooter>
              <FormDialogCancel>Cancel</FormDialogCancel>
            </FormDialogFooter>
          </FormDialogForm>
        ) : (
          <FormDialogFooter>
            <FormDialogCancel>Loading Cancel</FormDialogCancel>
          </FormDialogFooter>
        )}
      </FormDialog>
    </>
  );
}

describe('FormDialog focus', () => {
  it('starts on the first field of the form, not a footer button, when opened with the mouse', async () => {
    const user = userEvent.setup();
    render(<OpenedByClick />);

    await user.click(screen.getByRole('button', { name: 'Open' }));

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Send Reset Email' })).toHaveFocus(),
    );
  });

  it('moves to the first field once the form replaces its loading placeholder', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OpenedByClick loaded={false} />);

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    rerender(<OpenedByClick loaded />);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Send Reset Email' })).toHaveFocus(),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.getByRole('radio', { name: 'Send Reset Email' })).toHaveFocus();
  });
});
