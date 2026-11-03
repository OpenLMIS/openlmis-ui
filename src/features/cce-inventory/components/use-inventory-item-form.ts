import { revalidateLogic } from '@tanstack/react-form';
import { useAppForm } from '@/components/form/form';
import {
  type InventoryItemValues,
  inventoryItemSchema,
} from '@/features/cce-inventory/lib/inventory-item-form';

export function useInventoryItemForm(
  defaultValues: InventoryItemValues,
  onSubmit: (values: InventoryItemValues) => Promise<unknown>,
  onInvalid: () => void,
) {
  return useAppForm({
    defaultValues,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: inventoryItemSchema },
    onSubmit: ({ value }) => onSubmit(value),
    onSubmitInvalid: onInvalid,
  });
}

export type InventoryItemFormApi = ReturnType<typeof useInventoryItemForm>;
