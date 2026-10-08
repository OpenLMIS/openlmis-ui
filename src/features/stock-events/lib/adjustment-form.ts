import { z } from 'zod';
import { parseDateValue } from '@/components/form/date-value';
import { type QuantityValue, quantityValue } from '@/components/form/quantity-value';
import type { Reason } from '@/features/reference-data/lib/types';
import type { EventStockCard, StockEvent } from '@/features/stock-events/lib/types';
import { toWholeNumber, wholeNumberText } from '@/lib/whole-number';

const lineFields = z.object({
  key: z.string(),
  orderable: z.custom<EventStockCard['orderable']>(),
  lot: z.custom<EventStockCard['lot']>(),
  stockOnHand: z.number(),
  netContent: z.number().nullable().optional(),
  useVVM: z.boolean(),
  reasonId: z.string(),
  reasonFreeText: z.string(),
  quantity: z.object({ doses: z.string(), packs: z.string(), remainder: z.string() }),
  occurredDate: z.string(),
  vvmStatus: z.enum(['', 'STAGE_1', 'STAGE_2'], { error: 'stock-events.vvm-invalid' }),
});

export type AdjustmentLine = z.infer<typeof lineFields> & { quantity: QuantityValue };
export type AdjustmentFormValues = { lines: AdjustmentLine[] };
export type AdjustmentSchemaOptions = { reasons: readonly Reason[]; today: string };

export function newAdjustmentLine(
  card: EventStockCard,
  previousLine: AdjustmentLine | undefined,
  today: string,
): AdjustmentLine {
  return {
    key: crypto.randomUUID(),
    orderable: card.orderable,
    lot: card.lot,
    stockOnHand: card.stockOnHand,
    netContent: card.orderable.netContent,
    useVVM: card.orderable.extraData?.useVVM === 'true',
    reasonId: previousLine?.reasonId ?? '',
    reasonFreeText: previousLine?.reasonFreeText ?? '',
    quantity: quantityValue('', card.orderable.netContent),
    occurredDate: previousLine?.occurredDate ?? today,
    vvmStatus: '',
  };
}

export function changeAdjustmentReason(line: AdjustmentLine, reasonId: string): AdjustmentLine {
  return line.reasonId === reasonId ? line : { ...line, reasonId, reasonFreeText: '' };
}

export function adjustmentLinesSchema({ reasons, today }: AdjustmentSchemaOptions) {
  const byId = new Map(reasons.map((reason) => [reason.id, reason]));
  const row = lineFields.superRefine((line, context) => {
    const issue = (path: string[], message: string) =>
      context.addIssue({ code: 'custom', path, message });
    const reason = byId.get(line.reasonId);
    if (!reason) issue(['reasonId'], 'stock-events.required');

    const quantity = wholeNumberText(
      {
        required: 'stock-events.required',
        invalid: 'stock-events.positive-number',
        tooLarge: 'stock-events.number-too-large',
      },
      { min: { value: 1, tooSmall: 'stock-events.positive-number' } },
    ).safeParse(line.quantity.doses);
    if (!quantity.success) {
      for (const error of quantity.error.issues) issue(['quantity', 'doses'], error.message);
    } else if (
      reason?.reasonType === 'DEBIT' &&
      toWholeNumber(line.quantity.doses) > line.stockOnHand
    ) {
      issue(['quantity', 'doses'], 'stock-events.quantity-greater-than-stock-on-hand');
    }

    if (!line.occurredDate.trim()) issue(['occurredDate'], 'stock-events.required');
    else if (!parseDateValue(line.occurredDate)) {
      issue(['occurredDate'], 'stock-events.date-invalid');
    } else if (line.occurredDate > today) {
      issue(['occurredDate'], 'stock-events.date-future');
    }

    if (line.reasonFreeText.length > 255) {
      issue(['reasonFreeText'], 'stock-events.comments-too-long');
    }
    if (line.reasonFreeText.trim() && !reason?.isFreeTextAllowed) {
      issue(['reasonFreeText'], 'stock-events.comments-not-allowed');
    }
    if (line.vvmStatus && !line.useVVM) issue(['vvmStatus'], 'stock-events.vvm-not-allowed');
  });
  return z.object({ lines: z.array(row) });
}

export type AdjustmentPayloadOptions = {
  programId: string;
  facilityId: string;
  signature: string;
  lines: readonly AdjustmentLine[];
};

export function adjustmentPayload({
  programId,
  facilityId,
  signature,
  lines,
}: AdjustmentPayloadOptions): StockEvent {
  return {
    programId,
    facilityId,
    signature,
    eventOrigin: 'ADJUSTMENT',
    lineItems: lines.map((line) => ({
      orderableId: line.orderable.id,
      lotId: line.lot?.id ?? null,
      quantity: toWholeNumber(line.quantity.doses),
      occurredDate: line.occurredDate,
      reasonId: line.reasonId,
      ...(line.reasonFreeText.trim() && { reasonFreeText: line.reasonFreeText }),
      extraData: line.vvmStatus ? { vvmStatus: line.vvmStatus } : {},
    })),
  };
}
