import { revalidateLogic } from '@tanstack/react-form';
import { z } from 'zod';
import { useAppForm } from '@/components/form/form';
import { inventoryCountSchema } from '@/features/stock-events/lib/physical-inventory-form';
import type { InventoryLine } from '@/features/stock-events/lib/physical-inventory-types';

export function usePhysicalInventoryForm(lines: readonly InventoryLine[]) {
  return useAppForm({
    validationLogic: revalidateLogic({ mode: 'change' }),
    validators: {
      onDynamic: z
        .object({ lines: z.record(z.string(), z.custom<InventoryLine>()) })
        .superRefine((value, ctx) => {
          for (const line of Object.values(value.lines)) {
            if (!line.quantity.doses.trim()) continue;
            const result = inventoryCountSchema.safeParse(line.quantity.doses);
            for (const issue of result.error?.issues ?? [])
              ctx.addIssue({
                code: 'custom',
                path: ['lines', line.key, 'quantity', 'doses'],
                message: issue.message,
              });
          }
        }),
    },
    defaultValues: {
      lines: Object.fromEntries(lines.map((line) => [line.key, line])) as Record<
        string,
        InventoryLine
      >,
    },
  });
}
export type PhysicalInventoryForm = ReturnType<typeof usePhysicalInventoryForm>;
