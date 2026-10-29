import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requisitionGridQueries } from '@/features/requisitions/api/queries';
import { RequisitionTabs } from '@/features/requisitions/components/requisition-tabs';
import { useRequisitionForm } from '@/features/requisitions/hooks/use-requisition-form';
import { column, line, product, record } from '@/features/requisitions/lib/fixtures/builders';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

const clients: QueryClient[] = [];
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const client of clients.splice(0)) client.clear();
});
function renderEditor({ adjustments = false } = {}) {
  const value: RequisitionRecord = {
    ...record({
      template: {
        columnsMap: {
          'orderable.fullProductName': column('orderable.fullProductName', 0),
          totalConsumedQuantity: column('totalConsumedQuantity', 1, {
            source: 'USER_INPUT',
            columnDefinition: { columnType: 'NUMERIC' },
          }),
          adjustedConsumption: column('adjustedConsumption', 2),
          totalLossesAndAdjustments: column('totalLossesAndAdjustments', 3, {
            source: 'USER_INPUT',
          }),
          skipped: column('skipped', 4, { source: 'USER_INPUT' }),
        },
      },
      stockAdjustmentReasons: [{ id: 'credit', name: 'Credit', reasonType: 'CREDIT' }],
      requisitionLineItems: [line({ totalConsumedQuantity: 0, totalLossesAndAdjustments: 0 })],
    }),
    requisitionLineItems: [
      {
        ...line({ totalConsumedQuantity: 0, totalLossesAndAdjustments: 0 }),
        orderable: { id: 'product', versionNumber: 1 },
        approvedProduct: { id: 'approved', versionNumber: 1 },
      },
    ],
    id: 'r',
    facility: { id: 'f' },
    processingPeriod: { id: 'period' },
  };
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  clients.push(client);
  const data = [
    [product()],
    [],
    { durationInMonths: 1 },
    {
      currencyCode: 'USD',
      currencySymbol: '$',
      currencySymbolSide: 'left',
      currencyDecimalPlaces: 2,
      groupingSize: 3,
      groupingSeparator: ',',
      decimalSeparator: '.',
    },
    {},
  ];
  requisitionGridQueries(value).forEach((query, index) => {
    client.setQueryData<unknown>(query.queryKey, data[index]);
  });
  function Editor() {
    const editor = useRequisitionForm(value);
    return (
      <>
        {adjustments && (
          <button
            type="button"
            onClick={() =>
              editor.setLine('line', {
                stockAdjustments: [{ reasonId: 'credit', quantity: 3 }],
              })
            }
          >
            Add Adjustment
          </button>
        )}
        {adjustments && (
          <button
            type="button"
            onClick={() =>
              editor.setLine('line', {
                stockAdjustments: [],
              })
            }
          >
            Clear Adjustments
          </button>
        )}
        <RequisitionTabs
          record={value}
          editor={editor}
          editing={{
            editor,
            editable: true,
            pending: false,
            editableColumns: ['totalConsumedQuantity'],
            skipLines: true,
            addFullSupplyProduct: false,
            addNonFullSupplyProduct: false,
          }}
          search={{}}
          onSearchChange={vi.fn()}
          onAdjustments={vi.fn()}
          onCloseAdjustments={vi.fn()}
          supplyingStock={false}
          unit="DOSES"
          setUnit={vi.fn()}
          canSwitch={false}
          onTabChange={vi.fn()}
        />
      </>
    );
  }
  render(
    <QueryClientProvider client={client}>
      <Editor />
    </QueryClientProvider>,
  );
}
it.each(['abc', '1.5', '2147483648'])(
  'keeps invalid numeric text %s and its error without crashing calculated consumption',
  async (text) => {
    renderEditor();
    const input = await screen.findByRole('textbox', {
      name: 'totalConsumedQuantity: Product (P1)',
    });
    await userEvent.clear(input);
    await userEvent.type(input, text);
    expect(input).toHaveValue(text);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('requisitions.edit.invalid-lines')).toBeInTheDocument();
    expect(
      screen.getByText(
        text === '2147483648' ? 'stock-events.number-too-large' : 'stock-events.positive-number',
      ),
    ).toBeInTheDocument();
  },
);
it('updates skip eligibility from recalculated draft adjustments', async () => {
  renderEditor({ adjustments: true });
  const skip = await screen.findByRole('checkbox', { name: 'skipped: Product (P1)' });
  expect(skip).not.toHaveAttribute('aria-disabled', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Add Adjustment' }));
  expect(skip).toHaveAttribute('aria-disabled', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Clear Adjustments' }));
  expect(skip).not.toHaveAttribute('aria-disabled', 'true');
});
