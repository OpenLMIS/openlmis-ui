import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { LotSummary } from '@/features/reference-data/lib/types';
import { isNewLot } from '@/features/stock-events/lib/event-form';
import type { EventLot, NewLot } from '@/features/stock-events/lib/types';
import { conflictingDeviceLot, lotCodeSchema, sameLotCode } from '@/lib/lot-code';

type DraftLine = { key: string; lot: EventLot | null };
type LotContext = {
  lots: readonly LotSummary[];
  lines: readonly DraftLine[];
  today: string;
  deviceLots?: readonly NewLot[];
};

const errorKey = (key: ParseKeys) => key;

const lotFields = (today: string) =>
  z.object({
    lotCode: lotCodeSchema({
      required: 'stock-events.required',
      tooLong: 'stock-events.lot-code-too-long',
      invalid: 'stock-events.lot-code-invalid',
    }),
    expirationDate: z
      .string()
      .refine((date) => !date || date >= today, errorKey('stock-events.lot-expiry-past')),
  });

export type NewLotValues = z.infer<ReturnType<typeof lotFields>>;

function draftLotWithOtherExpiry(
  lines: readonly DraftLine[],
  tradeItemId: string,
  { lotCode, expirationDate }: NewLotValues,
  exceptKey?: string,
): boolean {
  return lines.some(
    ({ key, lot }) =>
      key !== exceptKey &&
      isNewLot(lot) &&
      lot.tradeItemId === tradeItemId &&
      sameLotCode(lot.lotCode, lotCode) &&
      (lot.expirationDate ?? '') !== expirationDate,
  );
}

const existingLot = (lots: readonly LotSummary[], lotCode: string) =>
  lots.some((lot) => sameLotCode(lot.lotCode, lotCode));

export function newLotSchema({
  tradeItemId,
  lots,
  lines,
  today,
  deviceLots = [],
}: LotContext & { tradeItemId: string }) {
  return lotFields(today).superRefine((values, context) => {
    if (conflictingDeviceLot(deviceLots, tradeItemId, values.lotCode, values.expirationDate)) {
      context.addIssue({
        code: 'custom',
        path: ['lotCode'],
        message: 'stock-events.lot-code-queued',
      });
      return;
    }
    if (existingLot(lots, values.lotCode) || draftLotWithOtherExpiry(lines, tradeItemId, values))
      context.addIssue({
        code: 'custom',
        path: ['lotCode'],
        message: 'stock-events.lot-code-exists',
      });
  });
}

export function editLotSchema({
  lot,
  lineKey,
  lots,
  lines,
  today,
  deviceLots = [],
}: LotContext & { lot: NewLot; lineKey: string }) {
  return lotFields(today).superRefine((values, context) => {
    if (conflictingDeviceLot(deviceLots, lot.tradeItemId, values.lotCode, values.expirationDate)) {
      context.addIssue({
        code: 'custom',
        path: ['lotCode'],
        message: 'stock-events.lot-code-queued',
      });
      return;
    }
    if (values.lotCode === lot.lotCode) return;
    if (existingLot(lots, values.lotCode))
      context.addIssue({
        code: 'custom',
        path: ['lotCode'],
        message: 'stock-events.lot-code-exists',
      });
    else if (draftLotWithOtherExpiry(lines, lot.tradeItemId, values, lineKey))
      context.addIssue({
        code: 'custom',
        path: ['expirationDate'],
        message: 'stock-events.lot-expiry-conflict',
      });
  });
}
