import { z } from 'zod';
import { parseDateValue } from '@/components/form/date-value';
import type { QuantityValue } from '@/components/form/quantity-value';
import type { Reason } from '@/features/reference-data/lib/types';
import { inventoryLineKey } from '@/features/stock-events/lib/physical-inventory-lines';
import type {
  InventoryLine,
  InventoryStockLine,
} from '@/features/stock-events/lib/physical-inventory-types';

export type InventoryReasonAssignment = {
  hidden: boolean;
  reason: Pick<Reason, 'id' | 'name' | 'reasonType'>;
};

export const inventoryReasons = (assignments: readonly InventoryReasonAssignment[]) =>
  assignments
    .filter((item) => !item.hidden && ['CREDIT', 'DEBIT'].includes(item.reason.reasonType))
    .map((item) => item.reason);

export function availableInventoryLots(
  eligible: readonly InventoryStockLine[],
  listed: readonly InventoryLine[],
  productId: string,
) {
  const keys = new Set(listed.map((line) => line.key));
  const available = eligible.filter(
    (line) =>
      line.orderable.id === productId && !keys.has(inventoryLineKey(productId, line.lot?.id)),
  );
  return [...available.filter((line) => !line.lot), ...available.filter((line) => line.lot)].sort(
    (a, b) => {
      const first = a.lot?.expirationDate;
      const second = b.lot?.expirationDate;
      return first && second ? first.localeCompare(second) : 0;
    },
  );
}

export function inventoryLotSchema(
  productId: string,
  listed: readonly InventoryStockLine[],
  today: string,
  excludeKey?: string,
) {
  return z.object({
    lotCode: z
      .string()
      .trim()
      .min(1, 'stock-events.required')
      .superRefine((code, ctx) => {
        if (
          listed.some((item) => {
            const line = item as InventoryLine;
            return (
              (!excludeKey || line.key !== excludeKey) &&
              item.orderable.id === productId &&
              (item.lot?.lotCode ?? line.newLot?.lotCode)?.toLowerCase() === code.toLowerCase()
            );
          })
        )
          ctx.addIssue({ code: 'custom', message: 'physical-inventory.lot-code-duplicate' });
      }),
    expirationDate: z
      .string()
      .refine(
        (date) => !date || (Boolean(parseDateValue(date)) && date >= today),
        'physical-inventory.lot-expiry-past',
      ),
  });
}

export function addedInventoryLine(
  stock: InventoryStockLine,
  quantity: QuantityValue,
  newLot?: InventoryLine['newLot'],
): InventoryLine {
  return {
    ...stock,
    ...(newLot && { lot: null, stockCardId: null, stockOnHand: 0 }),
    key: inventoryLineKey(stock.orderable.id, newLot ? null : stock.lot?.id, newLot?.clientId),
    quantity,
    stockAdjustments: [],
    vvmStatus: null,
    active: true,
    isAdded: true,
    justAdded: true,
    ...(newLot && { newLot }),
  };
}

export function canDeactivateInventoryLine(line: InventoryLine, online: boolean) {
  return (
    online &&
    Boolean(line.stockCardId) &&
    line.active === true &&
    line.stockOnHand === 0 &&
    !line.justAdded
  );
}

export function inventoryOptionalColumns(
  eligible: readonly InventoryStockLine[],
  lines: readonly InventoryLine[],
) {
  return {
    showVvm: eligible.some((line) => line.orderable.extraData?.useVVM === 'true'),
    showActions: lines.some((line) => line.justAdded || canDeactivateInventoryLine(line, true)),
  };
}
