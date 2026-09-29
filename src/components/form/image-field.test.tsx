import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useAppForm } from '@/components/form/form';
import { FormMessagesProvider } from '@/components/form/form-messages';

const logoSchema = z
  .custom<File | null | undefined>()
  .refine((file) => !(file instanceof File) || file.type === 'image/png', 'logo.type');

function TestForm({ canRemove = true }: { canRemove?: boolean }) {
  const form = useAppForm({ defaultValues: { logo: undefined as File | null | undefined } });

  return (
    <form>
      <form.AppField name="logo" validators={{ onChange: logoSchema }}>
        {(field) => (
          <field.ImageField
            accept="image/png"
            canRemove={canRemove}
            chooseLabel="Upload Logo"
            description="PNG only"
            label="Logo"
            previewAlt="Current logo"
            previewUrl="/current.png"
            removeLabel="Remove Logo"
          />
        )}
      </form.AppField>
      <form.Subscribe selector={(state) => state.values.logo}>
        {(logo) => (
          <output data-testid="value">
            {logo === undefined ? 'unchanged' : logo === null ? 'removed' : logo.name}
          </output>
        )}
      </form.Subscribe>
    </form>
  );
}

function renderForm(props?: { canRemove?: boolean }) {
  return render(
    <FormMessagesProvider formatError={(key) => `t(${key})`}>
      <TestForm {...props} />
    </FormMessagesProvider>,
  );
}

describe('ImageField', () => {
  it('shows the current image under the label', () => {
    renderForm();

    expect(screen.getByRole('img', { name: 'Current logo' })).toHaveAttribute(
      'src',
      '/current.png',
    );
    expect(screen.getByLabelText('Logo')).toHaveAttribute('type', 'file');
  });

  it('takes the picked file as the value', async () => {
    renderForm();

    await userEvent.upload(
      screen.getByLabelText('Logo'),
      new File(['x'], 'new.png', { type: 'image/png' }),
    );

    expect(screen.getByTestId('value')).toHaveTextContent('new.png');
  });

  it('shows the error of a refused file at once', async () => {
    renderForm();

    await userEvent.upload(
      screen.getByLabelText('Logo'),
      new File(['x'], 'logo.gif', { type: 'image/gif' }),
      { applyAccept: false },
    );

    expect(screen.getByText('t(logo.type)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload Logo' })).toHaveAccessibleDescription(
      /t\(logo.type\)/,
    );
    expect(screen.getByRole('button', { name: 'Upload Logo' })).toBeInvalid();
  });

  it('removes the image with Remove', async () => {
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Logo' }));

    expect(screen.getByTestId('value')).toHaveTextContent('removed');
  });

  it('offers no Remove when there is nothing to remove', () => {
    renderForm({ canRemove: false });

    expect(screen.queryByRole('button', { name: 'Remove Logo' })).not.toBeInTheDocument();
  });
});
