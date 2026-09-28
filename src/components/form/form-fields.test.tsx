import { revalidateLogic } from '@tanstack/react-form';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useAppForm } from '@/components/form/form';
import { FormMessagesProvider } from '@/components/form/form-messages';

const schema = z.object({
  name: z.string().min(1, 'name.required'),
  facility: z.string().nullable(),
  active: z.boolean(),
  method: z.string(),
  secret: z.string(),
  notes: z.string(),
  rights: z.array(z.string()),
});

const facilities = [
  { value: 'f1', label: 'HC01 - Comfort Health Clinic' },
  { value: 'f2', label: 'HF01 - Kankao Health Facility' },
];

const rights = [
  { value: 'r1', label: 'View Orders' },
  { value: 'r2', label: 'Edit Orders' },
  { value: 'r3', label: 'Transfer Orders' },
];

function TestForm({ onSubmit }: { onSubmit: (value: z.infer<typeof schema>) => void }) {
  const form = useAppForm({
    defaultValues: {
      name: '',
      facility: null as string | null,
      active: true,
      method: 'email',
      secret: '',
      notes: '',
      rights: ['r1'] as string[],
    },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppField name="name">
        {(field) => <field.TextField label="Name" required />}
      </form.AppField>
      <form.AppField name="facility">
        {(field) => (
          <field.ComboboxField
            clearLabel="Clear Facility"
            emptyMessage="None found"
            items={facilities}
            label="Facility"
          />
        )}
      </form.AppField>
      <form.AppField name="active">{(field) => <field.SwitchField label="Active" />}</form.AppField>
      <form.AppField name="method">
        {(field) => (
          <field.RadioGroupField
            label="Method"
            options={[
              { value: 'email', label: 'Email' },
              { value: 'manual', label: 'Manual' },
            ]}
          />
        )}
      </form.AppField>
      <form.AppField name="secret">
        {(field) => (
          <field.PasswordField
            describedBy="secret-rules"
            hideLabel="Hide"
            label="Secret"
            showLabel="Show"
          />
        )}
      </form.AppField>
      <form.AppField name="notes">{(field) => <field.TextareaField label="Notes" />}</form.AppField>
      <form.AppField name="rights">
        {(field) => (
          <field.MultiComboboxField
            emptyMessage="None found"
            items={rights}
            label="Rights"
            removeLabel={(label) => `Remove ${label}`}
          />
        )}
      </form.AppField>
      <button type="submit">Save</button>
    </form>
  );
}

function renderForm() {
  const onSubmit = vi.fn();
  render(
    <FormMessagesProvider formatError={(message) => `translated:${message}`}>
      <TestForm onSubmit={onSubmit} />
    </FormMessagesProvider>,
  );
  return { onSubmit };
}

describe('form fields', () => {
  it('shows formatted errors after submit and clears them as the field is fixed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('translated:name.required');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('lists the options in a listbox the combobox controls, so screen readers announce it', async () => {
    const user = userEvent.setup();
    renderForm();

    const combobox = screen.getByRole('combobox', { name: 'Facility' });
    await user.type(combobox, 'h');
    const listbox = await screen.findByRole('listbox');
    expect(combobox).toHaveAttribute('aria-controls', listbox.id);
    expect(listbox).not.toHaveAttribute('tabindex', '0');
  });

  it('stores the picked item by value, the switched-off setting and the chosen option', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
    await user.type(screen.getByRole('combobox', { name: 'Facility' }), 'kankao');
    await user.click(await screen.findByRole('option', { name: 'HF01 - Kankao Health Facility' }));
    await user.click(screen.getByRole('switch', { name: 'Active' }));
    await user.click(screen.getByRole('radio', { name: 'Manual' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Ada',
      facility: 'f2',
      active: false,
      method: 'manual',
      secret: '',
      notes: '',
      rights: ['r1'],
    });
  });

  it('keeps the values of the picked items and drops one when its chip is removed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
    await user.type(screen.getByLabelText('Notes'), 'Night shift');
    await user.type(screen.getByRole('combobox', { name: 'Rights' }), 'transfer');
    await user.click(await screen.findByRole('option', { name: 'Transfer Orders' }));
    await user.click(screen.getByRole('button', { name: 'Remove View Orders' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Night shift', rights: ['r3'] }),
    );
  });

  it('keeps the picked items when Escape is pressed with the list closed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
    await user.type(screen.getByRole('combobox', { name: 'Facility' }), 'kankao');
    await user.click(await screen.findByRole('option', { name: 'HF01 - Kankao Health Facility' }));
    await user.click(screen.getByRole('combobox', { name: 'Rights' }));
    await user.keyboard('{Escape}{Escape}');
    await user.click(screen.getByRole('combobox', { name: 'Facility' }));
    await user.keyboard('{Escape}{Escape}');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ facility: 'f2', rights: ['r1'] }),
    );
  });

  it('reveals the password and names the button for what it will do', async () => {
    const user = userEvent.setup();
    renderForm();
    const secret = screen.getByLabelText('Secret');

    expect(secret).toHaveAttribute('type', 'password');
    expect(secret).toHaveAttribute('aria-describedby', 'secret-rules');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(secret).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
  });
});
