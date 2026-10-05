import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useAppForm } from '@/components/form/form';

const calendarLoads = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/components/ui/calendar', async (importOriginal) => {
  calendarLoads.count += 1;
  if (calendarLoads.count === 1) throw new Error('Failed to fetch dynamically imported module');
  return importOriginal();
});

function OneDate() {
  const form = useAppForm({ defaultValues: { opened: '2026-10-01' } });
  return (
    <form.AppField name="opened">
      {(field) => <field.DateField label="Opened" placeholder="Pick A Date" />}
    </form.AppField>
  );
}

describe('date field calendar loading', () => {
  it('tries to load the calendar again when the first attempt failed and the picker is opened', async () => {
    const user = userEvent.setup();
    render(<OneDate />);

    await user.click(screen.getByRole('button', { name: /^Opened/ }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(calendarLoads.count).toBe(2);
  });
});
