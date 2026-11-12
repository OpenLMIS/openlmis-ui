import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { PodSearchPicker } from '@/features/orders/components/pod-search-picker';

const programs = [{ id: 'program', name: 'Family Planning' }];
const facilities = [{ id: 'facility', name: 'Clinic' }];
it.each(['requestingFacilityId', 'supplyingFacilityId'] as const)(
  'accepts a program with only %s and keeps edits as a draft until Search',
  async (field) => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const onDraftChange = vi.fn();
    render(
      <PodSearchPicker
        applied={{ programId: 'program', [field]: 'facility' }}
        requesting={field === 'requestingFacilityId' ? facilities : []}
        supplying={field === 'supplyingFacilityId' ? facilities : []}
        programs={programs}
        onSearch={onSearch}
        onDraftChange={onDraftChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));
    expect(onSearch).toHaveBeenCalledWith({ programId: 'program', [field]: 'facility' });
    onSearch.mockClear();
    const clears = screen.getAllByRole('button', { name: 'orders.pod.clear' });
    await user.click(clears[0]);
    expect(onDraftChange).toHaveBeenLastCalledWith({
      programId: 'program',
      requestingFacilityId: undefined,
      supplyingFacilityId: undefined,
    });
    expect(onSearch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));
    await waitFor(() => expect(screen.getAllByText('orders.required').length).toBeGreaterThan(0));
    expect(onSearch).not.toHaveBeenCalled();
  },
);
