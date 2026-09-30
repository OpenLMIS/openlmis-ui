import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-disabled', 'true');
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

describe('FormDialog focus with a hidden field', () => {
  it('skips a hidden input, such as a username kept for password managers', async () => {
    render(
      <FormDialog onOpenChange={vi.fn()} open>
        <FormDialogForm onSubmit={vi.fn()}>
          <FormDialogBody>
            <input autoComplete="username" hidden readOnly value="ada" />
            <input aria-label="New Password" type="password" />
          </FormDialogBody>
        </FormDialogForm>
      </FormDialog>,
    );

    await waitFor(() => expect(screen.getByLabelText('New Password')).toHaveFocus());
  });
});

/** Like a combobox in its own loading boundary: the field arrives after the form. */
function LateField() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);
  return loaded ? <input aria-label="User" /> : <div aria-busy />;
}

function OpenedWith({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Open
      </button>
      <FormDialog onOpenChange={setOpen} open={open}>
        <FormDialogForm onSubmit={vi.fn()}>
          <FormDialogBody>{children}</FormDialogBody>
          <FormDialogFooter>
            <FormDialogCancel>Cancel</FormDialogCancel>
          </FormDialogFooter>
        </FormDialogForm>
      </FormDialog>
    </>
  );
}

describe('FormDialog focus with fields that load late', () => {
  it('waits for a field still loading instead of starting on Cancel', async () => {
    const user = userEvent.setup();
    render(
      <OpenedWith>
        <LateField />
      </OpenedWith>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'User' })).toHaveFocus());
  });

  it('leaves focus where the user put it while the field loads', async () => {
    const user = userEvent.setup();
    render(
      <OpenedWith>
        <input aria-label="Note" tabIndex={-1} />
        <LateField />
      </OpenedWith>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('textbox', { name: 'Note' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'User' })).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveFocus();
  });
});

describe('FormDialog focus on touch', () => {
  afterEach(() => fireEvent.keyDown(document.body, { key: 'Tab' }));

  it('keeps focus on the dialog when a tap opened it, so no on-screen keyboard pops up', async () => {
    render(
      <OpenedWith>
        <input aria-label="Name" />
      </OpenedWith>,
    );
    const open = screen.getByRole('button', { name: 'Open' });

    fireEvent.pointerDown(open, { pointerType: 'touch' });
    fireEvent.click(open);

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('dialog')).toHaveFocus();
  });
});

describe('FormDialogSubmit', () => {
  it('keeps focus while it saves, so keyboard users are not dropped out of the dialog', async () => {
    const { rerender } = render(
      <FormDialog onOpenChange={vi.fn()} open>
        <FormDialogForm onSubmit={vi.fn()}>
          <FormDialogFooter>
            <FormDialogSubmit>Save</FormDialogSubmit>
          </FormDialogFooter>
        </FormDialogForm>
      </FormDialog>,
    );
    screen.getByRole('button', { name: 'Save' }).focus();

    rerender(
      <FormDialog onOpenChange={vi.fn()} open>
        <FormDialogForm onSubmit={vi.fn()}>
          <FormDialogFooter>
            <FormDialogSubmit pending>Save</FormDialogSubmit>
          </FormDialogFooter>
        </FormDialogForm>
      </FormDialog>,
    );

    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveFocus();
    expect(save).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('FormDialogForm while saving', () => {
  it('does not submit again when Enter is pressed in a field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <FormDialog onOpenChange={vi.fn()} open>
        <FormDialogForm onSubmit={onSubmit}>
          <FormDialogBody>
            <input aria-label="Name" />
          </FormDialogBody>
          <FormDialogFooter>
            <FormDialogSubmit pending>Save</FormDialogSubmit>
          </FormDialogFooter>
        </FormDialogForm>
      </FormDialog>,
    );

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
