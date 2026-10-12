import { z } from 'zod';
import { parseDateValue } from '@/components/form/date-value';
import { type QuantityValue, quantityValue } from '@/components/form/quantity-value';
import type { ValidAssignment } from '@/components/valid-assignments/types';
import type { Reason } from '@/features/reference-data/lib/types';
import {
  type ConfiguredEventKind,
  EVENT_KINDS,
  type EventKindConfig,
} from '@/features/stock-events/lib/event-kinds';
import {
  contentTotalsTooLarge,
  expandKitLines,
  type KitReasons,
  kitContentsProblem,
  MAX_CONTENT_QUANTITY,
} from '@/features/stock-events/lib/kit-unpack';
import type {
  EventLot,
  EventStockCard,
  NewLot,
  StockEvent,
  StockEventLineItem,
} from '@/features/stock-events/lib/types';
import { sameLotCode } from '@/lib/lot-code';
import { toWholeNumber, wholeNumberText } from '@/lib/whole-number';

const lineFields = z.object({
  key: z.string(),
  orderable: z.custom<EventStockCard['orderable']>(),
  lot: z.custom<EventLot | null>(),
  stockOnHand: z.number().nullable(),
  productHasLots: z.boolean(),
  netContent: z.number().nullable().optional(),
  useVVM: z.boolean(),
  counterparty: z.string(),
  counterpartyComments: z.string(),
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

export type EventLineOptions = Pick<EventSchemaOptions, 'kind'> &
  Partial<Omit<EventSchemaOptions, 'kind' | 'today'>>;
export type NewEventLineOptions = EventLineOptions & { productHasLots: boolean };

export type EventLineCandidate = Omit<EventStockCard, 'id' | 'lot'> & { lot: EventLot | null };

export function newEventLine(
  card: EventLineCandidate,
  previousLine: EventLine | undefined,
  today: string,
  { kind, assignments = [], reasons = [], defaultReasonId, productHasLots }: NewEventLineOptions,
): EventLine {
  const hasCounterparty = EVENT_KINDS[kind].counterparty !== 'none';
  return {
    key: crypto.randomUUID(),
    orderable: card.orderable,
    lot: card.lot,
    stockOnHand: card.stockOnHand,
    productHasLots,
    netContent: card.orderable.netContent,
    useVVM: card.orderable.extraData?.useVVM === 'true',
    counterparty: hasCounterparty ? (previousLine?.counterparty ?? '') : '',
    counterpartyComments:
      hasCounterparty &&
      assignments.find((item) => item.id === previousLine?.counterparty)?.isFreeTextAllowed
        ? (previousLine?.counterpartyComments ?? '')
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

function listedDefaultReasonId(reasons: readonly Reason[], defaultReasonId?: string): string {
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
  const quantitySchema = wholeNumberText(
    {
      required: 'stock-events.required',
      invalid: 'stock-events.positive-number',
      tooLarge: 'stock-events.number-too-large',
    },
    { min: { value: 1, tooSmall: 'stock-events.positive-number' } },
  );
  const row = lineFields.superRefine((line, context) => {
    const issue = (path: string[], message: string) =>
      context.addIssue({ code: 'custom', path, message });
    const reason = byId.get(line.reasonId);
    if (!reason && (eventReasonRequired(kind, reasons, defaultReasonId) || line.reasonId))
      issue(['reasonId'], 'stock-events.required');
    if (config.counterparty !== 'none') {
      const counterparty = assignments.find((item) => item.id === line.counterparty);
      if (!counterparty) issue(['counterparty'], 'stock-events.required');
      if (line.counterpartyComments.length > 255)
        issue(['counterpartyComments'], 'stock-events.comments-too-long');
      if (line.counterpartyComments.trim() && !counterparty?.isFreeTextAllowed)
        issue(['counterpartyComments'], 'stock-events.comments-not-allowed');
    }

    const quantity = quantitySchema.safeParse(line.quantity.doses);
    if (!quantity.success) {
      for (const error of quantity.error.issues) issue(['quantity', 'doses'], error.message);
    } else if (
      (config.stockOnHandCap === 'always' ||
        (config.stockOnHandCap === 'debit-reason' && reason?.reasonType === 'DEBIT')) &&
      line.stockOnHand !== null &&
      toWholeNumber(line.quantity.doses) > line.stockOnHand
    ) {
      issue(['quantity', 'doses'], 'stock-events.quantity-greater-than-stock-on-hand');
    }

    if (config.contents === 'kit') {
      const problem = kitContentsProblem(line.orderable);
      if (problem) {
        issue(
          ['quantity', 'doses'],
          problem === 'not-a-kit' ? 'stock-unpack.not-a-kit' : 'stock-unpack.contents-invalid',
        );
      } else if (quantity.success && expandedQuantityTooLarge(line)) {
        issue(['quantity', 'doses'], 'stock-unpack.contents-too-large');
      }
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
  const lines = z.array(row).superRefine((lines, context) => {
    if (config.contents !== 'kit') return;
    const contents = lines.map((line) => ({
      quantity:
        quantitySchema.safeParse(line.quantity.doses).success && !expandedQuantityTooLarge(line)
          ? toWholeNumber(line.quantity.doses)
          : 0,
      children: kitContentsProblem(line.orderable) ? undefined : line.orderable.children,
    }));
    for (const index of contentTotalsTooLarge(contents)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'quantity', 'doses'],
        message: 'stock-unpack.contents-too-large',
      });
    }
  });
  return z.object({ lines });
}

function expandedQuantityTooLarge(line: EventLine): boolean {
  return !!line.orderable.children?.some(
    (child) => toWholeNumber(line.quantity.doses) * (child.quantity ?? 0) > MAX_CONTENT_QUANTITY,
  );
}

export function changeEventCounterparty(line: EventLine, counterparty: string): EventLine {
  return line.counterparty === counterparty
    ? line
    : { ...line, counterparty, counterpartyComments: '' };
}

export function isNewLot(lot: EventLot | null | undefined): lot is NewLot {
  return !!lot && !('id' in lot);
}

export function changeEventLot(
  lines: readonly EventLine[],
  key: string,
  next: Pick<NewLot, 'lotCode' | 'expirationDate'>,
): EventLine[] {
  const old = lines.find((line) => line.key === key)?.lot;
  if (!isNewLot(old)) return [...lines];
  if (old.lotCode !== next.lotCode)
    return lines.map((line) => (line.key === key ? { ...line, lot: { ...old, ...next } } : line));
  return lines.map((line) =>
    isNewLot(line.lot) &&
    sameLotCode(line.lot.lotCode, old.lotCode) &&
    line.lot.expirationDate === old.expirationDate
      ? { ...line, lot: { ...line.lot, expirationDate: next.expirationDate } }
      : line,
  );
}

function lotFields(lot: EventLot | null): Pick<StockEventLineItem, 'lotId' | 'lot'> {
  if (!isNewLot(lot)) return { lotId: lot?.id ?? null };
  return {
    lot: {
      lotCode: lot.lotCode,
      ...(lot.expirationDate && { expirationDate: lot.expirationDate }),
    },
  };
}

function counterpartyFields(
  side: EventKindConfig['counterparty'],
  nodeId: string | undefined,
  comments: string | undefined,
): Partial<StockEventLineItem> {
  if (side === 'destination')
    return { destinationId: nodeId, ...(comments && { destinationFreeText: comments }) };
  if (side === 'source') return { sourceId: nodeId, ...(comments && { sourceFreeText: comments }) };
  return {};
}

export type EventPayloadOptions = {
  kind: ConfiguredEventKind;
  assignments?: readonly ValidAssignment[];
  programId: string;
  facilityId: string;
  signature?: string;
  kitReasons?: KitReasons;
  lines: readonly EventLine[];
};

export function eventPayload({
  kind,
  assignments = [],
  programId,
  facilityId,
  signature,
  kitReasons,
  lines,
}: EventPayloadOptions): StockEvent {
  const config = EVENT_KINDS[kind];
  if (config.contents === 'kit' && !kitReasons) {
    throw new Error('Kit unpack reasons are required');
  }
  const lineItems = lines.map((line) => ({
    orderableId: line.orderable.id,
    ...lotFields(line.lot),
    quantity: toWholeNumber(line.quantity.doses),
    occurredDate: line.occurredDate,
    ...(line.reasonId && { reasonId: line.reasonId }),
    ...counterpartyFields(
      config.counterparty,
      assignments.find((item) => item.id === line.counterparty)?.node.id,
      line.counterpartyComments.trim() ? line.counterpartyComments : undefined,
    ),
    ...(line.reasonFreeText.trim() && { reasonFreeText: line.reasonFreeText }),
    extraData: line.vvmStatus ? { vvmStatus: line.vvmStatus } : {},
  }));
  return {
    programId,
    facilityId,
    ...(config.confirmation.type === 'signature' && signature !== undefined && { signature }),
    ...(config.eventOrigin !== null && { eventOrigin: config.eventOrigin }),
    lineItems:
      config.contents === 'kit' && kitReasons
        ? expandKitLines(
            lineItems.map((item, index) => ({
              ...item,
              children: lines[index].orderable.children,
            })),
            kitReasons,
          )
        : lineItems,
  };
}
