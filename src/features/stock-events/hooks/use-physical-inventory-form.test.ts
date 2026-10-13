import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import { usePhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import { buildInventoryLines } from '@/features/stock-events/lib/physical-inventory-lines';

const line = buildInventoryLines(
  [
    {
      orderable: { id: 'p', productCode: 'P', fullProductName: 'P', description: null },
      lot: null,
      stockOnHand: 5,
      stockCardId: 'c',
      active: true,
    },
  ],
  [],
)[0];
it('allows blank counts before submit and validates them after submit', async () => {
  const { result, rerender } = renderHook(
    ({ submitted }) => usePhysicalInventoryForm([line], submitted),
    { initialProps: { submitted: false } },
  );
  await act(async () => {
    await result.current.validate('change');
  });
  expect(result.current.state.isValid).toBe(true);
  rerender({ submitted: true });
  await act(async () => {
    await result.current.validate('change');
  });
  expect(result.current.state.isValid).toBe(false);
});
it('validates a count as it changes while accepting zero', async () => {
  const { result } = renderHook(() => usePhysicalInventoryForm([line]));
  await act(async () => {
    result.current.setFieldValue('lines', {
      [line.key]: { ...line, quantity: quantityValue('2147483648') },
    });
    await result.current.validate('change');
  });
  expect(result.current.state.isValid).toBe(false);
  await act(async () => {
    result.current.setFieldValue('lines', {
      [line.key]: { ...line, quantity: quantityValue('0') },
    });
    await result.current.validate('change');
  });
  expect(result.current.state.isValid).toBe(true);
});
