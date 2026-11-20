import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enUS } from 'date-fns/locale';
import { describe, expect, it, vi } from 'vitest';
import { useAppForm } from '@/components/form/form';
import { FormMessagesProvider } from '@/components/form/form-messages';

const calendarLoads = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/components/ui/calendar', async (importOriginal) => {
  calendarLoads.count += 1;
  if (calendarLoads.count === 1) throw new Error('Failed to fetch dynamically imported module');
  return importOriginal();
});

function OneDate() {
  const form = useAppForm({ defaultValues: { opened: '2026-10-01' } });
  return (
    <form.AppField name="opened">{(field) => <field.DateField label="Opened" />}</form.AppField>
  );
}

describe('date field calendar loading', () => {
  it('tries to load the calendar again when the first attempt failed and the picker is opened', async () => {
    const user = userEvent.setup();
    render(<OneDate />);

    await user.click(screen.getByRole('button', { name: 'Open Calendar Opened' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(calendarLoads.count).toBe(2);
  });

  it('keeps keyboard focus and follows a date entered before the localized calendar loads', async () => {
    const user = userEvent.setup();
    let resolveLocale!: (locale: typeof enUS) => void;
    const locale = new Promise<typeof enUS>((resolve) => {
      resolveLocale = resolve;
    });
    render(
      <FormMessagesProvider formatError={String} loadDateLocale={() => locale}>
        <OneDate />
      </FormMessagesProvider>,
    );

    const input = screen.getByRole('textbox', { name: 'Opened' });
    await user.clear(input);
    await user.type(input, '1/3/2027');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('1/3/2027');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    resolveLocale(enUS);
    expect(await screen.findByRole('grid')).toHaveAttribute('aria-label', 'March 2027');
    expect(input).toHaveFocus();
  });
});
