import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useAppForm } from '@/components/form/form';

const calendar = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/calendar', () => ({
  Calendar: (props: unknown) => {
    calendar(props);
    return null;
  },
}));
function BoundedDate() {
  const form = useAppForm({ defaultValues: { date: '2026-10-01' } });
  return (
    <form.AppField name="date">
      {(field) => (
        <field.DateField
          label="Date"
          placeholder="Pick A Date"
          earliest="2026-09-01"
          latest="2026-10-07"
        />
      )}
    </form.AppField>
  );
}

describe('DateField bounds', () => {
  it('forwards both limits to its date picker', async () => {
    const user = userEvent.setup();
    render(<BoundedDate />);
    await user.click(screen.getByRole('button', { name: /^Date/ }));
    await screen.findByRole('dialog');
    expect(calendar).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: [{ before: new Date(2026, 8, 1) }, { after: new Date(2026, 9, 7) }],
      }),
    );
  });
});
