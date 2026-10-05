import { revalidateLogic } from '@tanstack/react-form';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
      <form.AppField name="name">
        {(field) => <field.TextField description="As on the ID card" label="Name" required />}
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
            action={<a href="/forgot">Forgot?</a>}
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
      <form.AppField name="code">
        {(field) => <field.TextField dir="ltr" label="Code" />}
      </form.AppField>
      <form.AppField name="order">{(field) => <field.NumberField label="Order" />}</form.AppField>
      <form.AppField name="price">{(field) => <field.DecimalField label="Price" />}</form.AppField>
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

  it('names the radio group by its label', () => {
    renderForm();

    expect(screen.getByRole('radiogroup', { name: 'Method' })).toBeInTheDocument();
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
      channel: 'EMAIL',
      code: '',
      order: '',
      price: '',
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

  it('reaches the action of a stacked field after its input, so Tab goes from label to input', () => {
    renderForm();
    const label = screen.getByText('Secret').closest('label') as HTMLElement;
    const input = screen.getByLabelText('Secret');
    const action = screen.getByRole('link', { name: 'Forgot?' });

    expect(label).not.toContainElement(action);
    expect(input.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the chosen item by its label and stores it by value', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    const channel = screen.getByRole('combobox', { name: 'Channel' });
    expect(channel).toHaveTextContent('Email');
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
    renderForm();
    expect(screen.getByRole('textbox', { name: 'Code' })).toHaveAttribute('dir', 'ltr');
  });

  it('offers a keypad with a decimal mark for a decimal, read left to right', () => {
    renderForm();
    const price = screen.getByRole('textbox', { name: 'Price' });

    expect(price).toHaveAttribute('inputmode', 'decimal');
    expect(price).toHaveAttribute('dir', 'ltr');
  });

  it('offers a number keypad for a number, read left to right, and keeps it as typed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const order = screen.getByRole('textbox', { name: 'Order' });

    expect(order).toHaveAttribute('inputmode', 'numeric');
    expect(order).toHaveAttribute('dir', 'ltr');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
    await user.type(order, '1.5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ order: '1.5' }));
  });

  it('tells screen readers what a field is for and, after a failed submit, what is wrong', async () => {
    const user = userEvent.setup();
    renderForm();
    const described = (element: HTMLElement) =>
      (element.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent)
        .join(' | ');

    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(described(name)).toBe('As on the ID card');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(described(name)).toBe('As on the ID card | translated:name.required');

    expect(described(screen.getByRole('combobox', { name: 'Channel' }))).toBe(
      'How messages reach you',
    );
  });
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

function ServerSearchForm({ onSearch }: { onSearch: (text: string) => void }) {
  const [items, setItems] = useState(catalogue);
  const form = useAppForm({ defaultValues: { picked: [] as string[] } });
  return (
    <form.AppField name="picked">
      {(field) => (
        <field.MultiComboboxField
          emptyMessage="No products"
          items={items}
          label="Products"
          onSearch={(text) => {
            onSearch(text);
            setItems(catalogue.filter((item) => item.label.includes(text.toUpperCase())));
          }}
          removeLabel={(label) => `Remove ${label}`}
        />
      )}
    </form.AppField>
  );
}

describe('a multi combobox that searches the server', () => {
  it('reports what is typed and keeps a picked item after the results move on', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<ServerSearchForm onSearch={onSearch} />);

    const input = screen.getByRole('combobox', { name: 'Products' });
    await user.type(input, 'g');
    expect(onSearch).toHaveBeenLastCalledWith('g');
    await user.click(await screen.findByRole('option', { name: 'G1 - Gloves' }));
    await user.clear(input);
    await user.type(input, 's');

    expect(await screen.findByRole('option', { name: 'S1 - Syringe' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: 'Remove G1 - Gloves' })).toBeInTheDocument();
  });
});

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

describe('a multi combobox that searches the server, picking several', () => {
  it('keeps the search and the list after each pick', async () => {
    const user = userEvent.setup();
    render(<ServerSearchForm onSearch={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: 'Products' });

    await user.type(input, '1');
    await user.click(await screen.findByRole('option', { name: 'G1 - Gloves' }));

    expect(input).toHaveValue('1');
    await user.click(screen.getByRole('option', { name: 'S1 - Syringe' }));
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: 'Remove G1 - Gloves' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove S1 - Syringe' })).toBeInTheDocument();
  });
});

describe('a multi combobox that searches the server, as the results change', () => {
  it('keeps the chips in the order they were picked', async () => {
    const user = userEvent.setup();
    render(<ServerSearchForm onSearch={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: 'Products' });

    await user.type(input, '1');
    await user.click(await screen.findByRole('option', { name: 'G1 - Gloves' }));
    await user.click(screen.getByRole('option', { name: 'S1 - Syringe' }));
    await user.clear(input);
    await user.type(input, 'S1');

    expect(
      screen
        .getAllByRole('button', { name: /^Remove /, hidden: true })
        .map((chip) => chip.getAttribute('aria-label')),
    ).toEqual(['Remove G1 - Gloves', 'Remove S1 - Syringe']);
  });
});

const dateSchema = z.object({
  opened: z.string(),
  kept: z.string(),
  started: z.string().min(1, 'started.required'),
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
        {(field) => (
          <field.DateField clearLabel="Clear Opened" label="Opened" placeholder="Pick A Date" />
        )}
      </form.AppField>
      <form.AppField name="kept">
        {(field) => <field.DateField label="Kept" placeholder="Pick A Date" />}
      </form.AppField>
      <form.AppField name="started">
        {(field) => <field.DateField label="Started" placeholder="Pick A Date" required />}
      </form.AppField>
      <button type="submit">Save</button>
    </form>
  );
}

const openCalendar = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.click(screen.getByRole('button', { name }));
  return screen.findByRole('dialog');
};

describe('date field', () => {
  it('names the picker by its label and its day, and stores the picked day as yyyy-MM-dd', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DateForm onSubmit={onSubmit} />);

    const calendar = await openCalendar(user, /^Opened Oct 1, 2026$/);
    expect(calendar).toHaveAccessibleName('Opened');
    await user.click(await within(calendar).findByRole('button', { name: /October 15th, 2026/ }));
    expect(screen.getByRole('button', { name: 'Opened Oct 15, 2026' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Started/ })).toHaveAccessibleDescription(
      'started.required',
    );
  });

  it('moves through the days by keyboard and picks the one in focus', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);

    const calendar = await openCalendar(user, /^Opened/);
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

    expect(screen.getByRole('button', { name: 'Opened Oct 9, 2026' })).toBeInTheDocument();
  });

  it('keeps a required date when its day is picked again', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);

    let calendar = await openCalendar(user, /^Started/);
    const today = (await within(calendar).findAllByRole('button', { name: /Today/ }))[0];
    if (!today) throw new Error('no today');
    await user.click(today);
    const picked = screen.getByRole('button', { name: /^Started/ }).textContent;

    calendar = await openCalendar(user, /^Started/);
    await user.click(
      (await within(calendar).findAllByRole('button', { name: /Today/ }))[0] as HTMLElement,
    );

    expect(screen.getByRole('button', { name: /^Started/ })).toHaveTextContent(picked ?? '');
    expect(screen.getByRole('button', { name: /^Started/ })).not.toHaveTextContent('Pick A Date');
  });

  it('empties an optional date with its clear button and keeps the focus on the field', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Clear Opened' }));

    const opened = screen.getByRole('button', { name: 'Opened Pick A Date' });
    expect(opened).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear Opened' })).toBeNull();
  });

  it('tells screen readers a date is required, with its label and value', () => {
    render(<DateForm onSubmit={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Started Required Pick A Date' }),
    ).toBeInTheDocument();
  });

  it('keeps a date that has no clear button when its day is picked again', async () => {
    const user = userEvent.setup();
    render(<DateForm onSubmit={vi.fn()} />);

    const calendar = await openCalendar(user, /^Kept/);
    await user.click(await within(calendar).findByRole('button', { name: /October 1st, 2026/ }));

    expect(screen.getByRole('button', { name: 'Kept Oct 1, 2026' })).toBeInTheDocument();
  });

  it('shows the date in the language it is given', () => {
    render(
      <FormMessagesProvider dateLanguage="pt" formatError={(message) => message}>
        <DateForm onSubmit={vi.fn()} />
      </FormMessagesProvider>,
    );

    expect(screen.getByRole('button', { name: /^Opened/ })).toHaveTextContent('1 de out. de 2026');
  });
});
