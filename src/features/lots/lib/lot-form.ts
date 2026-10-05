import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { Lot } from '@/features/lots/lib/types';

const errorKey = (key: ParseKeys) => key;

const MAX_CODE_LENGTH = 20;

/** The characters GS1 allows in a lot number, which the server enforces. */
const CODE_CHARACTERS = /^[!"%&'()*+,\-./0-9:;<=>?A-Z_a-z]*$/;

export function lotFormSchema(refusedCodes: readonly string[]) {
  const refused = new Set(refusedCodes.map((code) => code.toLowerCase()));
  return z.object({
    lotCode: z
      .string()
      .refine((code) => code.trim().length > 0, errorKey('lots.form.code-required'))
      .refine((code) => code.length <= MAX_CODE_LENGTH, errorKey('lots.form.code-too-long'))
      .refine((code) => CODE_CHARACTERS.test(code), errorKey('lots.form.code-invalid'))
      .refine((code) => !refused.has(code.toLowerCase()), errorKey('lots.form.code-taken')),
    expirationDate: z.string(),
    manufactureDate: z.string(),
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

export function isDuplicateLotCode(error: unknown) {
  return (
    isAxiosError<{ messageKey?: string }>(error) &&
    error.response?.data?.messageKey === 'referenceData.error.lot.lotCode.mustBeUnique'
  );
}
