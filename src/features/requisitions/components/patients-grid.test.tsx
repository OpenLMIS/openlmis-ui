import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PatientsGrid } from '@/features/requisitions/components/patients-grid';
import { useRequisitionForm } from '@/features/requisitions/hooks/use-requisition-form';
import { record } from '@/features/requisitions/lib/fixtures/builders';
import { parsePatients } from '@/features/requisitions/lib/patients';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

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
  const { rerender } = render(<PatientsGrid patients={parsePatients(data(123, true))} />);
  const card = screen.getByText('123').closest('li');
  expect(card).not.toBeNull();
  expect(within(card as HTMLElement).queryByText('998')).not.toBeInTheDocument();
  expect(within(card as HTMLElement).queryByText('2')).not.toBeInTheDocument();
  expect(within(card as HTMLElement).getByText('requisitions.yes')).toBeInTheDocument();
  rerender(<PatientsGrid patients={parsePatients(data(456, false))} />);
  expect(screen.queryByText('123')).not.toBeInTheDocument();
  expect(screen.getByText('456')).toBeInTheDocument();
  expect(screen.getByText('requisitions.no')).toBeInTheDocument();
});

it('enforces Skip and live required errors in the editable layout at phone width', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(390);
  const base = {
    ...record(),
    id: 'patients',
    facility: { id: 'f' },
    processingPeriod: { id: 'p' },
  } as RequisitionRecord;
  function Editor() {
    const editor = useRequisitionForm(base);
    return <PatientsGrid patients={parsePatients(null)} editor={editor} />;
  }
  render(<Editor />);
  const inputs = await screen.findAllByRole('textbox', {
    name: 'requisitions.patients.cell-label',
  });
  expect(inputs).toHaveLength(66);
  await waitFor(() => expect(inputs[0]).toBeEnabled());
  const skip = screen.getByRole('checkbox', {
    name: 'requisitions.patients.skip: requisitions.patients.adult-patients',
  });
  fireEvent.change(inputs[0], { target: { value: '0' } });
  await waitFor(() => expect(skip).toHaveAttribute('aria-disabled', 'true'));
  expect(inputs[1]).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(inputs[0], { target: { value: '' } });
  await waitFor(() => expect(skip).not.toHaveAttribute('aria-disabled', 'true'));
  expect(inputs[1]).not.toHaveAttribute('aria-invalid', 'true');
  fireEvent.click(skip);
  await waitFor(() => expect(inputs[0]).toBeDisabled());
});
