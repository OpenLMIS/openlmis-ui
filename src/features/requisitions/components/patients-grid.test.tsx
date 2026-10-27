import { render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PatientsGrid } from '@/features/requisitions/components/patients-grid';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('uses the current record and shows only its enabled months in cards', () => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(390);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const data = (value: number, skipped: boolean) =>
    JSON.stringify({
      TBData: [
        [
          {
            key: 'numberOfAdultPatients',
            isSkipped: skipped,
            data: [
              { value, disabled: false },
              { value: 998, disabled: true },
            ],
          },
        ],
      ],
      leprosyData: [[]],
    });
  const { rerender } = render(<PatientsGrid patientsData={data(123, true)} />);
  const card = screen.getByText('123').closest('li');
  expect(card).not.toBeNull();
  expect(within(card as HTMLElement).queryByText('998')).not.toBeInTheDocument();
  expect(within(card as HTMLElement).queryByText('2')).not.toBeInTheDocument();
  expect(within(card as HTMLElement).getByText('requisitions.yes')).toBeInTheDocument();
  rerender(<PatientsGrid patientsData={data(456, false)} />);
  expect(screen.queryByText('123')).not.toBeInTheDocument();
  expect(screen.getByText('456')).toBeInTheDocument();
  expect(screen.getByText('requisitions.no')).toBeInTheDocument();
});
