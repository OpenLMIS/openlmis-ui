import { z } from 'zod';
import { isInventoryMember } from '@/features/stock-events/lib/physical-inventory-lines';
import type {
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
  const count = toOptionalWholeNumber(line.quantity.doses);
  if (count === null) return null;
  return (
    count -
    (line.stockOnHand ?? 0) -
    line.stockAdjustments.reduce(
      (sum, adjustment) =>
        sum +
        (adjustment.reason.reasonType === 'DEBIT' ? -adjustment.quantity : adjustment.quantity),
      0,
    )
  );
}

export function validateInventory(
  lines: readonly InventoryLine[],
  displayed: readonly InventoryLine[],
) {
  if (displayed.some((line) => !line.active && line.stockOnHand === 0))
    return { kind: 'inactive' } as const;
  const invalid = lines.filter(
    (line) =>
      isInventoryMember(line) &&
      (!line.active && line.stockOnHand === 0 && !line.quantity.doses.trim()
        ? false
        : !inventoryCountSchema.safeParse(line.quantity.doses).success ||
          unaccounted(line) !== 0 ||
          line.stockAdjustments.some((reason) => !inventoryReasonSchema.safeParse(reason).success)),
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
