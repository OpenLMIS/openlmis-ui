import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { FormMessagesProvider } from '@/components/form/form-messages';
import { SignatureDialog } from '@/features/stock-events/components/signature-dialog';
import { IsolatingICU } from '@/lib/isolate-values';

const i18n = createInstance();
beforeAll(() =>
  i18n
    .use(IsolatingICU)
    .init({ lng: 'en', resources: { en: { translation: en } }, keySeparator: false }),
);
function dialog(pending: boolean, onConfirm: (signature: string) => void) {
  return (
    <I18nextProvider i18n={i18n}>
      <FormMessagesProvider formatError={(key) => i18n.t(key, { defaultValue: key })}>
        <SignatureDialog
          onConfirm={onConfirm}
          onOpenChange={vi.fn()}
          open
          pending={pending}
          username="ada"
        />
      </FormMessagesProvider>
    </I18nextProvider>
  );
}

describe('SignatureDialog', () => {
  it('accepts an empty signature and names the submitting user', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(dialog(false, onConfirm));
    const input = screen.getByRole('textbox', { name: 'Signature' });
    expect(input).toHaveAccessibleDescription('Submitted By ada');
    expect(screen.getByRole('dialog', { name: 'Choose Signature' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(''));
  });
  it('rejects a signature longer than 255 and accepts the boundary', async () => {
    const onConfirm = vi.fn();
    render(dialog(false, onConfirm));
    fireEvent.change(screen.getByLabelText('Signature'), { target: { value: 'a'.repeat(256) } });
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Signature is too long')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Signature'), { target: { value: 'a'.repeat(255) } });
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('a'.repeat(255)));
  });
  it('blocks repeated submit and dismiss while pending', async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(dialog(false, onConfirm));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
    rerender(dialog(true, onConfirm));
    fireEvent.submit(screen.getByLabelText('Signature').closest('form') as HTMLFormElement);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
