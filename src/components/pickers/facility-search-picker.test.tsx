import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { FacilitySearchPicker } from '@/components/pickers/facility-search-picker';

const options = [
  { id: 'facility-0', name: 'Clinic 0', code: 'F0', active: true },
  { id: 'facility-1', name: 'Clinic 1', code: 'F1', active: true },
];

it('reports a cleared facility as no draft, as View Requisitions expects', async () => {
  const user = userEvent.setup();
  const onDraftChange = vi.fn();
  render(
    <FacilitySearchPicker
      options={options}
      applied={options[0].id}
      label="Facility"
      placeholder="Select Facility"
      clearLabel="Clear Facility"
      emptyMessage="No facilities"
      onDraftChange={onDraftChange}
      onSearch={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Clear Facility' }));
  expect(onDraftChange).toHaveBeenLastCalledWith(null);
});
