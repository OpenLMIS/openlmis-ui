import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { Lot } from '@/features/lots/lib/types';
import { dateValue } from '@/lib/date-value';
import { lotCodeSchema } from '@/lib/lot-code';

const errorKey = (key: ParseKeys) => key;

export function lotFormSchema(refusedCodes: readonly string[]) {
  const refused = new Set(refusedCodes.map((code) => code.toLowerCase()));
  return z.object({
    lotCode: lotCodeSchema({
      required: 'lots.form.code-required',
      tooLong: 'lots.form.code-too-long',
      invalid: 'lots.form.code-invalid',
    }).refine((code) => !refused.has(code.toLowerCase()), errorKey('lots.form.code-taken')),
    expirationDate: dateValue({ optional: true }),
    manufactureDate: dateValue({ optional: true }),
  });
}

export type LotFormValues = z.infer<ReturnType<typeof lotFormSchema>>;

export function toLotFormValues(lot: Lot): LotFormValues {
  return {
    lotCode: lot.lotCode,
    expirationDate: lot.expirationDate ?? '',
    manufactureDate: lot.manufactureDate ?? '',
  };
}

export function toLotBody(values: LotFormValues, saved: Lot): Lot {
  return {
    ...saved,
    lotCode: values.lotCode,
    expirationDate: values.expirationDate || null,
    manufactureDate: values.manufactureDate || null,
  };
}

export const LOT_FIELD_ERRORS = {
  'referenceData.error.lot.lotCode.mustBeUnique': { field: 'lotCode', key: 'lots.form.code-taken' },
} as const;
