import { revalidateLogic } from '@tanstack/react-form';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Profiler } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useAppForm } from '@/components/form/form';
import { FormMessagesProvider } from '@/components/form/form-messages';
import { quantityValue } from '@/components/form/quantity-value';

type Unit = 'DOSES' | 'PACKS';
const schema = z.object({
  quantity: z.object({
    doses: z.string().regex(/^[0-9]+$/, 'quantity.invalid'),
    packs: z.string(),
    remainder: z.string(),
  }),
});
function QuantityForm({ unit, onSubmit }: { unit: Unit; onSubmit: (value: unknown) => void }) {
  const form = useAppForm({
    defaultValues: { quantity: quantityValue('50', 16) },
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
      <form.AppField name="quantity">
        {(field) => (
          <field.QuantityField
            label="Quantity, C1 LC2017A"
            layout="inline"
            packsLabel="Packs"
            dosesLabel="Doses"
            netContent={16}
            unit={unit}
            required
          />
        )}
      </form.AppField>
      <button type="submit">Save</button>
    </form>
  );
}

describe('QuantityField form wiring', () => {
  it('shows unit placeholders and a visible plus in Packs mode', () => {
    render(<QuantityForm onSubmit={vi.fn()} unit="PACKS" />);
    expect(screen.getByRole('textbox', { name: 'Quantity, C1 LC2017A Packs' })).toHaveAttribute(
      'placeholder',
      'Packs',
    );
    expect(screen.getByRole('textbox', { name: 'Quantity, C1 LC2017A Doses' })).toHaveAttribute(
      'placeholder',
      'Doses',
    );
    expect(screen.getByText('+')).toBeVisible();
  });

  it('switches units without changing doses and names both pack inputs for their row', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(<QuantityForm onSubmit={onSubmit} unit="DOSES" />);
    expect(screen.getByRole('textbox', { name: 'Quantity, C1 LC2017A' })).toHaveValue('50');
    rerender(<QuantityForm onSubmit={onSubmit} unit="PACKS" />);
    const packs = screen.getByRole('textbox', { name: 'Quantity, C1 LC2017A Packs' });
    expect(packs).toHaveValue('3');
    expect(screen.getByRole('textbox', { name: 'Quantity, C1 LC2017A Doses' })).toHaveValue('2');
    await user.clear(packs);
    await user.type(packs, '4');
    rerender(<QuantityForm onSubmit={onSubmit} unit="DOSES" />);
    expect(screen.getByRole('textbox', { name: 'Quantity, C1 LC2017A' })).toHaveValue('66');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({
      quantity: { doses: '66', packs: '4', remainder: '2' },
    });
  });

  it('retains invalid pack text through unit switches and resolves validation message keys', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const view = (unit: Unit) => (
      <FormMessagesProvider formatError={(key) => `translated:${key}`}>
        <QuantityForm onSubmit={onSubmit} unit={unit} />
      </FormMessagesProvider>
    );
    const { rerender } = render(view('PACKS'));
    const packs = screen.getByRole('textbox', { name: 'Quantity, C1 LC2017A Packs' });
    await user.clear(packs);
    await user.type(packs, '1.5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('translated:quantity.invalid');
    expect(packs).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
    rerender(view('DOSES'));
    expect(screen.getByRole('textbox', { name: 'Quantity, C1 LC2017A' })).toHaveValue(
      '1.5 * 16 + 2',
    );
    rerender(view('PACKS'));
    expect(screen.getByRole('textbox', { name: 'Quantity, C1 LC2017A Packs' })).toHaveValue('1.5');
  });
});

it('does not commit QuantityFields for an unrelated field change', () => {
  const updates = vi.fn();
  const rows = Array.from({ length: 100 }, (_, index) => ({
    id: `row-${index}`,
    quantity: quantityValue('32', 16),
  }));
  function Fixture() {
    const form = useAppForm({
      defaultValues: {
        note: '',
        lines: rows,
      },
    });
    return (
      <>
        <form.AppField name="note">{(field) => <field.TextField label="Note" />}</form.AppField>
        {rows.map((row, index) => (
          <Profiler
            key={row.id}
            id={String(index)}
            onRender={(_, phase) => {
              if (phase === 'update') updates(index);
            }}
          >
            <form.AppField name={`lines[${index}].quantity`}>
              {(field) => (
                <field.QuantityField
                  label={`Row ${index}`}
                  dosesLabel="Doses"
                  packsLabel="Packs"
                  netContent={16}
                  unit="DOSES"
                />
              )}
            </form.AppField>
          </Profiler>
        ))}
      </>
    );
  }
  render(<Fixture />);
  updates.mockClear();
  fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'a' } });
  expect(updates).not.toHaveBeenCalled();
});
