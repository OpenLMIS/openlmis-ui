import { revalidateLogic } from '@tanstack/react-form';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useAppForm } from '@/components/form/form';
import { DatePicker } from '@/components/form/form-fields';
import { FormMessagesProvider } from '@/components/form/form-messages';
import { TranslatedFormMessages } from '@/components/i18n/translated-form-messages';
import { dateValue } from '@/lib/date-value';

afterEach(() => vi.useRealTimers());

const schema = z.object({
  name: z.string().min(1, 'name.required'),
  facility: z.string().nullable(),
  active: z.boolean(),
  method: z.string(),
  secret: z.string(),
  notes: z.string(),
  rights: z.array(z.string()),
  channel: z.string(),
  code: z.string(),
  order: z.string(),
  price: z.string(),
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

type FieldName = keyof z.infer<typeof schema>;

function TestForm({
  fields,
  onSubmit,
}: {
  fields: readonly FieldName[];
  onSubmit: (value: z.infer<typeof schema>) => void;
}) {
  const form = useAppForm({
    defaultValues: {
      name: '',
      facility: null as string | null,
      active: true,
      method: 'email',
      secret: '',
      notes: '',
      rights: ['r1'] as string[],
      channel: 'EMAIL',
      code: '',
      order: '',
      price: '',
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
      {fields.includes('name') && (
        <form.AppField name="name">
          {(field) => <field.TextField description="As on the ID card" label="Name" required />}
        </form.AppField>
      )}
      {fields.includes('facility') && (
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
      )}
      {fields.includes('active') && (
        <form.AppField name="active">
          {(field) => <field.SwitchField label="Active" />}
        </form.AppField>
      )}
      {fields.includes('method') && (
        <form.AppField name="method">
          {(field) => (
            <field.RadioGroupField
              label="Method"
              options={[
                { value: 'email', label: 'Email' },
                { value: 'manual', label: 'Manual' },
                { value: 'post', label: 'Post', disabled: true },
              ]}
            />
          )}
        </form.AppField>
      )}
      {fields.includes('secret') && (
        <form.AppField name="secret">
          {(field) => (
            <field.PasswordField
              action={<a href="/forgot">Forgot?</a>}
              describedBy="secret-rules"
              hideLabel="Hide"
              label="Secret"
              showLabel="Show"
            />
          )}
        </form.AppField>
      )}
      {fields.includes('notes') && (
        <form.AppField name="notes">
          {(field) => <field.TextareaField label="Notes" />}
        </form.AppField>
      )}
      {fields.includes('rights') && (
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
      )}
      {fields.includes('channel') && (
        <form.AppField name="channel">
          {(field) => (
            <field.SelectField
              description="How messages reach you"
              items={[
                { value: 'EMAIL', label: 'Email' },
                { value: 'SMS', label: 'SMS' },
                { value: 'FAX', label: 'Fax', disabled: true },
              ]}
              label="Channel"
            />
          )}
        </form.AppField>
      )}
      {fields.includes('code') && (
        <form.AppField name="code">
          {(field) => <field.TextField dir="ltr" label="Code" />}
        </form.AppField>
      )}
      {fields.includes('order') && (
        <form.AppField name="order">{(field) => <field.NumberField label="Order" />}</form.AppField>
      )}
      {fields.includes('price') && (
        <form.AppField name="price">
          {(field) => <field.DecimalField label="Price" />}
        </form.AppField>
      )}
      <button type="submit">Save</button>
    </form>
  );
}

function renderForm(fields: readonly FieldName[]) {
  const onSubmit = vi.fn();
  render(
    <FormMessagesProvider formatError={(message) => `translated:${message}`}>
      <TestForm fields={fields} onSubmit={onSubmit} />
    </FormMessagesProvider>,
  );
  return { onSubmit };
}

describe('form fields', () => {
  it('shows formatted errors after submit and clears them as the field is fixed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm(['name']);

    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name).toHaveAccessibleDescription('As on the ID card');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('translated:name.required');
    expect(name).toHaveAccessibleDescription('As on the ID card translated:name.required');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps a disabled option from being picked, leaving the others open', async () => {
    const user = userEvent.setup();
    renderForm(['method']);

    await user.click(screen.getByRole('radio', { name: 'Post' }));

    expect(screen.getByRole('radio', { name: 'Post' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('radio', { name: 'Post' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Manual' })).not.toHaveAttribute('aria-disabled');
  });

  it('stores the picked item by value, the switched-off setting and the chosen option', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm(['name', 'facility', 'active', 'method']);
    expect(screen.getByRole('radiogroup', { name: 'Method' })).toBeInTheDocument();

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
      channel: 'EMAIL',
      code: '',
      order: '',
      price: '',
    });
  });

  it('keeps the values of the picked items and drops one when its chip is removed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm(['name', 'notes', 'rights']);

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
    const { onSubmit } = renderForm(['name', 'facility', 'rights']);

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
    renderForm(['secret']);
    const secret = screen.getByLabelText('Secret');

    expect(secret).toHaveAttribute('type', 'password');
    expect(secret).toHaveAttribute('aria-describedby', 'secret-rules');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(secret).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
  });

  it('reaches the action of a stacked field after its input, so Tab goes from label to input', () => {
    renderForm(['secret']);
    const label = screen.getByText('Secret').closest('label') as HTMLElement;
    const input = screen.getByLabelText('Secret');
    const action = screen.getByRole('link', { name: 'Forgot?' });

    expect(label).not.toContainElement(action);
    expect(input.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the chosen item by its label and stores it by value', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm(['name', 'channel']);

    const channel = screen.getByRole('combobox', { name: 'Channel' });
    expect(channel).toHaveTextContent('Email');
    expect(channel).toHaveAccessibleDescription('How messages reach you');
    await user.click(channel);
    expect(await screen.findByRole('option', { name: 'Fax' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('option', { name: 'SMS' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ channel: 'SMS' }));
  });

  it('keeps a code-like value left to right in any language', () => {
    renderForm(['code']);
    expect(screen.getByRole('textbox', { name: 'Code' })).toHaveAttribute('dir', 'ltr');
  });

  it('offers a keypad with a decimal mark for a decimal, read left to right', () => {
    renderForm(['price']);
    const price = screen.getByRole('textbox', { name: 'Price' });

    expect(price).toHaveAttribute('inputmode', 'decimal');
    expect(price).toHaveAttribute('dir', 'ltr');
  });

  it('offers a number keypad for a number, read left to right, and keeps it as typed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm(['name', 'order']);
    const order = screen.getByRole('textbox', { name: 'Order' });

    expect(order).toHaveAttribute('inputmode', 'numeric');
    expect(order).toHaveAttribute('dir', 'ltr');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
    await user.type(order, '1.5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ order: '1.5' }));
  });
});

it('updates existing validation errors after a language change without losing the draft', async () => {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: 'en',
    keySeparator: false,
    nsSeparator: false,
    resources: {
      en: { translation: { 'name.required': 'Name Required' } },
      pt: { translation: { 'name.required': 'Nome Obrigatório' } },
    },
  });
  const user = userEvent.setup();
  render(
    <I18nextProvider i18n={i18n}>
      <TranslatedFormMessages>
        <TestForm fields={['name', 'notes']} onSubmit={vi.fn()} />
      </TranslatedFormMessages>
    </I18nextProvider>,
  );
  const notes = screen.getByRole('textbox', { name: 'Notes' });
  await user.type(notes, 'Unsaved note');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Name Required');
  const name = screen.getByRole('textbox', { name: 'Name' });
  expect(name).toHaveAccessibleDescription('As on the ID card Name Required');

  await act(() => i18n.changeLanguage('pt'));

  expect(screen.getByRole('alert')).toHaveTextContent('Nome Obrigatório');
  expect(name).toHaveAccessibleDescription('As on the ID card Nome Obrigatório');
  expect(screen.getByRole('textbox', { name: 'Notes' })).toBe(notes);
  expect(notes).toHaveValue('Unsaved note');
});

function LayoutForm() {
  const form = useAppForm({
    defaultValues: { email: '', digest: false, notify: true, active: true, locked: false },
  });
  return (
    <form>
      <form.AppField name="email">
        {(field) => <field.TextField badge={<span>Verified</span>} label="Email" layout="row" />}
      </form.AppField>
      <form.AppField name="digest">
        {(field) => <field.SwitchField label="Use Digest" layout="inline" />}
      </form.AppField>
      <form.AppField name="notify">
        {(field) => (
          <field.SwitchField description="Get every notification" label="Notify" layout="row" />
        )}
      </form.AppField>
      <form.AppField name="active">
        {(field) => <field.SwitchField description="Can sign in" label="Active" />}
      </form.AppField>
      <form.AppField name="locked">{(field) => <field.SwitchField label="Locked" />}</form.AppField>
    </form>
  );
}

function TooltipErrorForm({ layout }: { layout: 'row' | 'inline' }) {
  const form = useAppForm({ defaultValues: { driver: '' } });
  return (
    <form.AppField
      name="driver"
      validators={{ onChange: ({ value }) => (value ? undefined : 'Name Required') }}
      listeners={{ onBlur: ({ fieldApi }) => void fieldApi.validate('change') }}
    >
      {(field) => <field.TextField label="Delivered By" layout={layout} hideErrors required />}
    </form.AppField>
  );
}

it.each(['row', 'inline'] as const)(
  'shows %s field errors in a tooltip on focus and clears them after correction',
  async (layout) => {
    const user = userEvent.setup();
    render(<TooltipErrorForm layout={layout} />);
    const input = screen.getByRole('textbox', { name: 'Delivered By' });
    await user.click(input);
    await user.tab();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Name Required');
    await user.tab({ shift: true });
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Name Required');
    await user.type(input, 'Driver');
    await waitFor(() => expect(input).not.toHaveAttribute('aria-invalid', 'true'));
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  },
);

describe('field layouts', () => {
  it('reads a row badge out with its field', () => {
    render(<LayoutForm />);

    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription('Verified');
  });

  it('names an inline switch by its hidden label and describes it only by what is shown', () => {
    render(<LayoutForm />);

    expect(screen.getByRole('switch', { name: 'Use Digest' })).not.toHaveAttribute(
      'aria-describedby',
    );
    expect(screen.getByRole('switch', { name: 'Notify' })).toHaveAccessibleDescription(
      'Get every notification',
    );
  });

  it('keeps a switch description behind its info button and still reads it out', async () => {
    const user = userEvent.setup();
    render(
      <FormMessagesProvider
        aboutLabel={(label) => `translated about ${label}`}
        formatError={(message) => message}
      >
        <LayoutForm />
      </FormMessagesProvider>,
    );

    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAccessibleDescription(
      'Can sign in',
    );
    expect(screen.queryByRole('button', { name: 'translated about Locked' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'translated about Active' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Can sign in');
    expect(screen.getByRole('switch', { name: 'Active' })).toBeChecked();
  });
});

function LockedComboboxForm() {
  const form = useAppForm({ defaultValues: { facility: 'f1' as string | null } });
  return (
    <form.AppField name="facility">
      {(field) => (
        <field.ComboboxField
          clearLabel="Clear Facility"
          disabled
          emptyMessage="No facilities"
          items={facilities}
          label="Facility"
        />
      )}
    </form.AppField>
  );
}

describe('a locked combobox', () => {
  it('shows its item and offers no way to clear it', () => {
    render(<LockedComboboxForm />);

    expect(screen.getByRole('combobox', { name: 'Facility' })).toHaveValue(
      'HC01 - Comfort Health Clinic',
    );
    expect(screen.queryByRole('button', { name: 'Clear Facility' })).not.toBeInTheDocument();
  });
});

const catalogue = [
  { value: 'g1', label: 'G1 - Gloves' },
  { value: 's1', label: 'S1 - Syringe' },
];

function OrderedChipsForm() {
  const form = useAppForm({ defaultValues: { picked: ['s1', 'g1'] } });
  return (
    <form.AppField name="picked">
      {(field) => (
        <field.MultiComboboxField
          emptyMessage="No products"
          items={catalogue}
          label="Products"
          removeLabel={(label) => `Remove ${label}`}
        />
      )}
    </form.AppField>
  );
}

describe('a multi combobox', () => {
  it('lists the chips in the order of its items, whatever the order of the value', () => {
    render(<OrderedChipsForm />);

    expect(
      screen
        .getAllByRole('button', { name: /^Remove / })
        .map((chip) => chip.getAttribute('aria-label')),
    ).toEqual(['Remove G1 - Gloves', 'Remove S1 - Syringe']);
  });
});

const dateSchema = z.object({
  opened: z.string(),
  kept: z.string(),
  started: dateValue({ optional: true }).pipe(z.string().min(1, 'started.required')),
});

function DateForm({ onSubmit }: { onSubmit: (value: z.infer<typeof dateSchema>) => void }) {
  const form = useAppForm({
    defaultValues: { opened: '2026-10-01', kept: '2026-10-01', started: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: dateSchema },
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppField name="opened">
        {(field) => <field.DateField clearLabel="Clear Opened" label="Opened" />}
      </form.AppField>
      <form.AppField name="kept">{(field) => <field.DateField label="Kept" />}</form.AppField>
      <form.AppField name="started">
        {(field) => <field.DateField label="Started" required />}
      </form.AppField>
      <button type="submit">Save</button>
      <button type="button" onClick={() => form.reset()}>
        Reset
      </button>
    </form>
  );
}

const openCalendar = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.click(screen.getByRole('button', { name }));
  return screen.findByRole('dialog');
};

describe('date field', () => {
  it('keeps typed text in focus, blocks invalid submits and submits valid text without a blur', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DateForm onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox', { name: /^Started/ });
    await user.click(input);
    await user.paste('9999-01-01');
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('9999-01-01');
    expect(input).toHaveAccessibleDescription('form.date-invalid');
    expect(onSubmit).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, '1/2/2024');
    expect(input).toHaveValue('1/02/2024');
    expect(await screen.findByRole('grid')).toHaveAttribute('aria-label', 'February 2024');
    await user.keyboard('{Escape}');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(input).toHaveFocus();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ started: '2024-02-01' }));
    await user.tab();
    expect(input).toHaveValue('01/02/2024');
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });
  it('advances through the date only when typing at the end', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DateForm onSubmit={onSubmit} />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: /^Started/ });

    await user.type(input, '5');
    expect(input).toHaveValue('05/');
    await user.keyboard('{Backspace}');
    expect(input).toHaveValue('05');
    await user.keyboard('/05/2026{Enter}');
    expect(input).toHaveValue('05/05/2026');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ started: '2026-05-05' }));

    await user.clear(input);
    await user.paste('5');
    expect(input).toHaveValue('5');
    input.setSelectionRange(0, 0);
    await user.keyboard('5');
    expect(input).toHaveValue('55');
    input.setSelectionRange(1, 2);
    await user.keyboard('8');
    expect(input).toHaveValue('58');
  });
  it('advances IME input after composition ends, whichever event the browser sends last', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: /^Started/ });
    input.focus();
    const compose = (text: string, inputBeforeEnd: boolean) => {
      fireEvent.compositionStart(input);
      const commit = { target: { value: text }, inputType: 'insertCompositionText' };
      if (inputBeforeEnd) fireEvent.input(input, { ...commit, isComposing: true });
      fireEvent.compositionEnd(input);
      if (!inputBeforeEnd) fireEvent.input(input, { ...commit, isComposing: false });
    };

    compose('٥', true);
    expect(input).toHaveValue('٠٥/');
    compose('٠٥/٠', true);
    compose('٠٥/٠٣', false);
    expect(input).toHaveValue('٠٥/٠٣/');

    input.setSelectionRange(0, input.value.length);
    compose('5', true);
    expect(input).toHaveValue('5');
    await user.paste('8');
    expect(input).toHaveValue('58');
  });
  it('replaces the focused spelling when an external form reset restores the same canonical value', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: 'Opened' });
    await user.clear(input);
    await user.type(input, '1/10/2026');
    expect(input).toHaveValue('1/10/2026');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(input).toHaveFocus();
    expect(input).toHaveValue('01/10/2026');
  });

  it('names the textbox by its label and stores the picked day as yyyy-MM-dd', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 13), toFake: ['Date'] });
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DateForm onSubmit={onSubmit} />);

    const calendar = await openCalendar(user, /^Open Calendar Opened$/);
    expect(calendar).toHaveAccessibleName('Opened');
    await user.click(await within(calendar).findByRole('button', { name: /October 15th, 2026/ }));
    expect(screen.getByRole('textbox', { name: 'Opened' })).toHaveValue('15/10/2026');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: /^Started/ })).toHaveAccessibleDescription(
      'started.required',
    );

    const startedCalendar = await openCalendar(user, /^Open Calendar Started/);
    await user.click(
      await within(startedCalendar).findByRole('button', { name: /October 16th, 2026/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({
      opened: '2026-10-15',
      kept: '2026-10-01',
      started: '2026-10-16',
    });
  });

  it('moves through the days by keyboard and picks the one in focus', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);

    const opened = screen.getByRole('textbox', { name: 'Opened' });
    await user.tab();
    expect(opened).toHaveFocus();
    const calendar = await screen.findByRole('dialog', { name: 'Opened' });
    await user.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(within(calendar).getByRole('button', { name: /October 1st, 2026/ })).toHaveFocus(),
    );
    await user.keyboard('{ArrowRight}');
    await waitFor(() =>
      expect(within(calendar).getByRole('button', { name: /October 2nd, 2026/ })).toHaveFocus(),
    );
    await user.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(within(calendar).getByRole('button', { name: /October 9th, 2026/ })).toHaveFocus(),
    );
    await user.keyboard('{Enter}');

    expect(opened).toHaveValue('09/10/2026');
    expect(opened).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Tab from the textbox and keeps moving through the form', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);
    const opened = screen.getByRole('textbox', { name: 'Opened' });
    await user.click(opened);
    await screen.findByRole('dialog', { name: 'Opened' });

    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Kept' })).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: 'Opened' })).not.toBeInTheDocument();
    await screen.findByRole('dialog', { name: 'Kept' });

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Clear Opened' })).toHaveFocus();
  });

  it('skips the calendar button on Tab and opens it with focus in the textbox on click', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);
    const opened = screen.getByRole('textbox', { name: 'Opened' });
    const button = screen.getByRole('button', { name: 'Open Calendar Opened' });

    await user.tab();
    expect(opened).toHaveFocus();
    await screen.findByRole('dialog', { name: 'Opened' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Opened' })).not.toBeInTheDocument();

    const calendar = await openCalendar(user, /^Open Calendar Opened$/);
    expect(opened).toHaveFocus();
    await user.click(button);
    expect(opened).toHaveFocus();
    expect(calendar).toBeVisible();
    await user.keyboard('{ArrowDown}');
    expect(calendar).toContainElement(document.activeElement as HTMLElement);

    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Kept' })).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: 'Opened' })).not.toBeInTheDocument();
    await screen.findByRole('dialog', { name: 'Kept' });
  });

  it('reopens when the focused input is clicked after Escape', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);
    const opened = screen.getByRole('textbox', { name: 'Opened' });
    await user.click(opened);
    await screen.findByRole('dialog', { name: 'Opened' });
    await user.keyboard('{Escape}');
    expect(opened).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(opened);
    await screen.findByRole('dialog', { name: 'Opened' });
  });

  it('interprets ambiguous year-first text identically when typed and pasted', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <FormMessagesProvider dateFormat="yyyy-dd-MM" formatError={String}>
        <DateForm onSubmit={onSubmit} />
      </FormMessagesProvider>,
    );
    const input = screen.getByRole('textbox', { name: /^Started/ });
    await user.type(input, '2026-03-04{Enter}');
    await user.clear(input);
    await user.paste('2026-03-04');
    await user.keyboard('{Enter}');

    expect(onSubmit.mock.calls.map(([value]) => value.started)).toEqual([
      '2026-04-03',
      '2026-04-03',
    ]);

    onSubmit.mockClear();
    await user.clear(input);
    await user.paste('2026-01-13');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveAccessibleDescription('form.date-invalid');
    expect(input).toHaveValue('2026-01-13');
  });

  it('keeps a required date when its day is picked again', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);

    let calendar = await openCalendar(user, /^Open Calendar Started/);
    const today = (await within(calendar).findAllByRole('button', { name: /Today/ }))[0];
    if (!today) throw new Error('no today');
    await user.click(today);
    const started = screen.getByRole<HTMLInputElement>('textbox', { name: 'Started Required' });
    expect(started).toBeRequired();
    const picked = started.value;

    calendar = await openCalendar(user, /^Open Calendar Started/);
    await user.click(
      (await within(calendar).findAllByRole('button', { name: /Today/ }))[0] as HTMLElement,
    );

    expect(started).toHaveValue(picked);
    expect(started).not.toHaveValue('');
  });

  it('empties an optional date with its clear button and keeps the focus on the field', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Clear Opened' }));

    const opened = screen.getByRole('textbox', { name: 'Opened' });
    expect(opened).toHaveValue('');
    expect(opened).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear Opened' })).toBeNull();
  });

  it('keeps a date that has no clear button when its day is picked again', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);

    const calendar = await openCalendar(user, /^Open Calendar Kept/);
    await user.click(await within(calendar).findByRole('button', { name: /October 1st, 2026/ }));

    expect(screen.getByRole('textbox', { name: 'Kept' })).toHaveValue('01/10/2026');
  });
});

function BoundedDate() {
  const form = useAppForm({ defaultValues: { date: '2019-01-15' } });
  return (
    <form.AppField name="date">
      {(field) => (
        <field.DateField label="Latest Expiry" earliest="2019-01-10" latest="2019-01-20" />
      )}
    </form.AppField>
  );
}

describe('date picker', () => {
  it.each([1900, 2126])('picks a date in year %i through the year dropdown', async (year) => {
    vi.useFakeTimers({ now: new Date(2026, 9, 13), toFake: ['Date'] });
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePicker id="expiry" label="Expiry" onValueChange={onValueChange} value="2026-01-15" />,
    );

    const calendar = await openCalendar(user, /^Open Calendar Expiry/);
    const years = await within(calendar).findByRole('combobox', { name: 'Choose the Year' });
    await user.selectOptions(years, String(year));
    await user.click(
      within(calendar).getByRole('button', { name: new RegExp(`January 16th, ${year}`) }),
    );

    expect(onValueChange).toHaveBeenCalledWith(`${year}-01-16`);
  });

  it('offers only the days between its earliest and latest', async () => {
    const user = userEvent.setup();
    render(<BoundedDate />);

    const calendar = await openCalendar(user, /^Open Calendar Latest Expiry/);
    expect(
      await within(calendar).findByRole('button', { name: /January 9th, 2019/ }),
    ).toBeDisabled();
    expect(within(calendar).getByRole('button', { name: /January 10th, 2019/ })).toBeEnabled();
    expect(within(calendar).getByRole('button', { name: /January 20th, 2019/ })).toBeEnabled();
    expect(within(calendar).getByRole('button', { name: /January 21st, 2019/ })).toBeDisabled();
  });

  it('keeps a click on the calendar that a page update interrupts', async () => {
    const user = userEvent.setup();
    const picker = (onValueChange: (value: string) => void) => (
      <DatePicker id="expiry" label="Expiry" onValueChange={onValueChange} value="2019-01-15" />
    );
    const { rerender } = render(picker(vi.fn()));

    const calendar = await openCalendar(user, /^Open Calendar Expiry/);
    const next = await within(calendar).findByRole('button', { name: /next month/i });
    await user.pointer({ keys: '[MouseLeft>]', target: next });
    rerender(picker(vi.fn()));
    await user.pointer({ keys: '[/MouseLeft]', target: next });

    expect(within(calendar).getByRole('grid')).toHaveAttribute('aria-label', 'February 2019');
  });
});

function ReverseFields({ selected = '' }: { selected?: string }) {
  const form = useAppForm({ defaultValues: { reason: selected, comments: '' } });
  return (
    <>
      <form.AppField name="reason">
        {(field) => (
          <field.SelectField
            items={[{ value: 'r1', label: 'Cancellation' }]}
            label="Reason"
            layout="inline"
            placeholder="Select an option"
          />
        )}
      </form.AppField>
      <form.AppField name="comments">
        {(field) => <field.TextareaField label="Comments" layout="inline" maxLength={255} />}
      </form.AppField>
    </>
  );
}

describe('reverse inline fields', () => {
  it('shows the supplied placeholder for an empty selection', () => {
    render(<ReverseFields />);
    expect(screen.getByRole('combobox', { name: 'Reason' })).toHaveTextContent('Select an option');
  });
  it('shows the selected label instead of the placeholder', () => {
    render(<ReverseFields selected="r1" />);
    expect(screen.getByRole('combobox', { name: 'Reason' })).toHaveTextContent('Cancellation');
    expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
  });
  it('gives inline comments a one-row size and a hard length cap', () => {
    render(<ReverseFields />);
    const comments = screen.getByRole('textbox', { name: 'Comments' });
    expect(comments).toHaveAttribute('maxlength', '255');
    expect(comments).toHaveAttribute('rows', '1');
    expect(comments).toHaveAttribute('data-size', 'inline');
  });
});

function EmptyValueSelect() {
  const form = useAppForm({ defaultValues: { vvm: '' } });
  return (
    <form.AppField name="vvm">
      {(field) => (
        <field.SelectField
          label="VVM Status"
          items={[
            { value: '', label: 'None' },
            { value: '1', label: 'Stage 1' },
          ]}
        />
      )}
    </form.AppField>
  );
}
it('shows the label for a SelectField item with an empty value', () => {
  render(<EmptyValueSelect />);
  expect(screen.getByRole('combobox', { name: 'VVM Status' })).toHaveTextContent('None');
});
