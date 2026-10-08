import { useStore } from '@tanstack/react-form';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { EventLineTable } from '@/features/stock-events/components/event-line-table';
import { useAdjustmentForm } from '@/features/stock-events/hooks/use-adjustment-form';
import { newAdjustmentLine } from '@/features/stock-events/lib/adjustment-form';
import { renderPage } from '@/tests/render-page';

const renders = vi.hoisted(() => vi.fn());
vi.mock('@/components/form/form-fields', async (load) => {
  const actual = await load<typeof import('@/components/form/form-fields')>();
  const { useFieldContext } = await import('@/components/form/form-context');
  return {
    ...actual,
    QuantityField: (props: Parameters<typeof actual.QuantityField>[0]) => {
      renders(useFieldContext().name);
      return <actual.QuantityField {...props} />;
    },
  };
});
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
it('renders only the changed quantity row out of 10 visible rows', async () => {
  const seeded = Array.from({ length: 10 }, (_, index) =>
    newAdjustmentLine(
      {
        stockOnHand: 50,
        orderable: {
          id: String(index),
          productCode: `C${index}`,
          fullProductName: `Product ${index}`,
          netContent: 16,
        },
        lot: null,
      },
      undefined,
      '2026-10-08',
    ),
  );
  const reasons: never[] = [];
  const onRemove = vi.fn();
  const onSearchChange = vi.fn();
  function Fixture() {
    const form = useAdjustmentForm({
      reasons,
      today: '2026-10-08',
      onValid: vi.fn(),
      onInvalid: vi.fn(),
    });
    useEffect(() => {
      form.setFieldValue('lines', seeded);
    }, [form]);
    const lines = useStore(form.store, (state) => state.values.lines);
    return (
      <EventLineTable
        form={form}
        lines={lines}
        reasons={reasons}
        unit="DOSES"
        today="2026-10-08"
        disabled={false}
        onRemove={onRemove}
        search={{ size: 10 }}
        onSearchChange={onSearchChange}
        columnVisibility={{}}
        onClearFilter={vi.fn()}
      />
    );
  }
  renderPage(<Fixture />);
  await waitFor(() =>
    expect(document.querySelector('[name="lines[0].quantity.doses"]')).toBeInTheDocument(),
  );
  renders.mockClear();
  fireEvent.change(document.querySelector('[name="lines[0].quantity.doses"]') as HTMLInputElement, {
    target: { value: '2' },
  });
  expect(renders).toHaveBeenCalled();
  expect(new Set(renders.mock.calls.map(([name]) => name))).toEqual(new Set(['lines[0].quantity']));
  expect(screen.getAllByRole('textbox')).toHaveLength(10);
});
