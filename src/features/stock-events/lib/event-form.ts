import { z } from 'zod';
import { parseDateValue } from '@/components/form/date-value';
import { type QuantityValue, quantityValue } from '@/components/form/quantity-value';
import type { ValidAssignment } from '@/components/valid-assignments/types';
import type { Reason } from '@/features/reference-data/lib/types';
import { type ConfiguredEventKind, EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import type { EventStockCard, StockEvent } from '@/features/stock-events/lib/types';
import { toWholeNumber, wholeNumberText } from '@/lib/whole-number';

const lineFields = z.object({
  key: z.string(),
  orderable: z.custom<EventStockCard['orderable']>(),
  lot: z.custom<EventStockCard['lot']>(),
  stockOnHand: z.number(),
  netContent: z.number().nullable().optional(),
  useVVM: z.boolean(),
  destination: z.string(),
  destinationComments: z.string(),
  reasonId: z.string(),
  reasonFreeText: z.string(),
  quantity: z.object({ doses: z.string(), packs: z.string(), remainder: z.string() }),
  occurredDate: z.string(),
  vvmStatus: z.enum(['', 'STAGE_1', 'STAGE_2'], { error: 'stock-events.vvm-invalid' }),
});

export type EventLine = z.infer<typeof lineFields> & { quantity: QuantityValue };
export type EventFormValues = { lines: EventLine[] };
export type EventSchemaOptions = {
  kind: ConfiguredEventKind;
  reasons: readonly Reason[];
  today: string;
  assignments?: readonly ValidAssignment[];
  defaultReasonId?: string;
};

export function newEventLine(
  card: EventStockCard,
  previousLine: EventLine | undefined,
  today: string,
  {
    kind,
    assignments = [],
    reasons = [],
    defaultReasonId,
  }: Pick<EventSchemaOptions, 'kind'> & Partial<Omit<EventSchemaOptions, 'kind' | 'today'>>,
): EventLine {
  return {
    key: crypto.randomUUID(),
    orderable: card.orderable,
    lot: card.lot,
    stockOnHand: card.stockOnHand,
    netContent: card.orderable.netContent,
    useVVM: card.orderable.extraData?.useVVM === 'true',
    destination:
      EVENT_KINDS[kind].counterparty === 'destination' ? (previousLine?.destination ?? '') : '',
    destinationComments:
      EVENT_KINDS[kind].counterparty === 'destination' &&
      assignments.find((item) => item.id === previousLine?.destination)?.isFreeTextAllowed
        ? (previousLine?.destinationComments ?? '')
        : '',
    reasonId: previousLine?.reasonId || listedDefaultReasonId(reasons, defaultReasonId),
    reasonFreeText: previousLine?.reasonFreeText ?? '',
    quantity: quantityValue('', card.orderable.netContent),
    occurredDate: previousLine?.occurredDate || today,
    vvmStatus: '',
  };
}

export function changeEventReason(line: EventLine, reasonId: string): EventLine {
  return line.reasonId === reasonId ? line : { ...line, reasonId, reasonFreeText: '' };
}

export function listedDefaultReasonId(
  reasons: readonly Reason[],
  defaultReasonId?: string,
): string {
  return reasons.find((reason) => reason.id === defaultReasonId)?.id ?? '';
}

export function eventReasonRequired(
  kind: ConfiguredEventKind,
  reasons: readonly Reason[],
  defaultReasonId?: string,
): boolean {
  return EVENT_KINDS[kind].reasonRequired || !!listedDefaultReasonId(reasons, defaultReasonId);
}

export function eventLinesSchema({
  kind,
  reasons,
  today,
  assignments = [],
  defaultReasonId,
}: EventSchemaOptions) {
  const byId = new Map(reasons.map((reason) => [reason.id, reason]));
  const config = EVENT_KINDS[kind];
  const row = lineFields.superRefine((line, context) => {
    const issue = (path: string[], message: string) =>
      context.addIssue({ code: 'custom', path, message });
    const reason = byId.get(line.reasonId);
    if (!reason && (eventReasonRequired(kind, reasons, defaultReasonId) || line.reasonId))
      issue(['reasonId'], 'stock-events.required');
    if (config.counterparty === 'destination') {
      const destination = assignments.find((item) => item.id === line.destination);
      if (!destination) issue(['destination'], 'stock-events.required');
      if (line.destinationComments.length > 255)
        issue(['destinationComments'], 'stock-events.comments-too-long');
      if (line.destinationComments.trim() && !destination?.isFreeTextAllowed)
        issue(['destinationComments'], 'stock-events.comments-not-allowed');
    }

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
      (config.stockOnHandCap === 'always' ||
        (config.stockOnHandCap === 'debit-reason' && reason?.reasonType === 'DEBIT')) &&
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

export function changeEventDestination(line: EventLine, destination: string): EventLine {
  return line.destination === destination
    ? line
    : { ...line, destination, destinationComments: '' };
}

export type EventPayloadOptions = {
  kind: ConfiguredEventKind;
  assignments?: readonly ValidAssignment[];
  programId: string;
  facilityId: string;
  signature: string;
  lines: readonly EventLine[];
};

export function eventPayload({
  kind,
  assignments = [],
  programId,
  facilityId,
  signature,
  lines,
}: EventPayloadOptions): StockEvent {
  return {
    programId,
    facilityId,
    signature,
    eventOrigin: EVENT_KINDS[kind].eventOrigin,
    lineItems: lines.map((line) => ({
      orderableId: line.orderable.id,
      lotId: line.lot?.id ?? null,
      quantity: toWholeNumber(line.quantity.doses),
      occurredDate: line.occurredDate,
      ...(line.reasonId && { reasonId: line.reasonId }),
      ...(EVENT_KINDS[kind].counterparty === 'destination' && {
        destinationId: assignments.find((item) => item.id === line.destination)?.node.id,
        ...(line.destinationComments.trim() && { destinationFreeText: line.destinationComments }),
      }),
      ...(line.reasonFreeText.trim() && { reasonFreeText: line.reasonFreeText }),
      extraData: line.vvmStatus ? { vvmStatus: line.vvmStatus } : {},
    })),
  };
}
