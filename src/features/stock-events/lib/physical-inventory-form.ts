import { z } from 'zod';
import { isInventoryMember } from '@/features/stock-events/lib/physical-inventory-lines';
import type {
  InventoryAdjustment,
  InventoryLine,
  InventoryStockLine,
  PhysicalInventoryDraft,
} from '@/features/stock-events/lib/physical-inventory-types';
import { toOptionalWholeNumber, wholeNumberText } from '@/lib/whole-number';

export const inventoryCountSchema = wholeNumberText({
  required: 'stock-events.required',
  invalid: 'stock-events.positive-number',
  tooLarge: 'stock-events.number-too-large',
});
export const inventoryReasonSchema = z.object({
  reason: z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    reasonType: z.enum(['CREDIT', 'DEBIT']),
  }),
  quantity: z.number().int().min(1).max(2_147_483_647),
});

export function unaccounted(line: InventoryLine) {
  const count = toOptionalWholeNumber(line.quantity.doses) ?? 0;
  return count - (line.stockOnHand ?? 0) - adjustmentTotal(line.stockAdjustments);
}

export function inventoryLineError(line: InventoryLine) {
  if (!line.active && line.stockOnHand === 0 && !line.quantity.doses.trim()) return null;
  const count = inventoryCountSchema.safeParse(line.quantity.doses);
  if (!count.success) return count.error.issues[0].message;
  if (unaccounted(line) !== 0) return 'physical-inventory.unaccounted-error';
  if (line.stockAdjustments.some((reason) => !inventoryReasonSchema.safeParse(reason).success))
    return 'physical-inventory.invalid-description';
  return null;
}

export function validateInventory(
  lines: readonly InventoryLine[],
  displayed: readonly InventoryLine[],
  includeInactive = false,
) {
  if (displayed.some((line) => !line.active && line.stockOnHand === 0))
    return { kind: 'inactive' } as const;
  const invalid = lines.filter(
    (line) =>
      (includeInactive || !(!line.active && line.stockOnHand === 0)) &&
      isInventoryMember(line) &&
      inventoryLineError(line),
  );
  return invalid.length
    ? ({ kind: 'invalid', lines: invalid } as const)
    : ({ kind: 'valid' } as const);
}

const extraData = (line: InventoryLine) =>
  line.orderable.extraData?.useVVM === 'true' && line.vvmStatus
    ? { vvmStatus: line.vvmStatus }
    : {};

export function inventorySavePayload(
  draft: PhysicalInventoryDraft,
  lines: readonly InventoryLine[],
  eligible: readonly InventoryStockLine[],
) {
  const members = lines.filter(isInventoryMember);
  const lineItems = members.length
    ? members.map((line) => ({
        orderableId: line.orderable.id,
        lotId: line.lot?.id ?? null,
        quantity: toOptionalWholeNumber(line.quantity.doses) ?? -1,
        extraData: extraData(line),
        stockAdjustments: line.stockAdjustments.map((adjustment) => ({
          reason: { id: adjustment.reason.id },
          quantity: adjustment.quantity,
        })),
      }))
    : eligible.map((line) => ({ orderableId: line.orderable.id, lotId: line.lot?.id ?? null }));
  return { id: draft.id, facilityId: draft.facilityId, programId: draft.programId, lineItems };
}

export function inventorySubmitPayload(
  draft: PhysicalInventoryDraft,
  lines: readonly InventoryLine[],
  occurredDate: string,
  signature: string,
) {
  return {
    resourceId: draft.id,
    facilityId: draft.facilityId,
    programId: draft.programId,
    signature,
    lineItems: lines.filter(isInventoryMember).map((line) => ({
      orderableId: line.orderable.id,
      lotId: line.lot?.id ?? null,
      quantity: toOptionalWholeNumber(line.quantity.doses) ?? 0,
      occurredDate,
      extraData: extraData(line),
      stockAdjustments: line.stockAdjustments.map((adjustment) => ({
        reasonId: adjustment.reason.id,
        quantity: adjustment.quantity,
      })),
    })),
  };
}

export function adjustmentTotal(adjustments: readonly InventoryAdjustment[]) {
  return adjustments.reduce(
    (sum, item) => sum + (item.reason.reasonType === 'DEBIT' ? -item.quantity : item.quantity),
    0,
  );
}
