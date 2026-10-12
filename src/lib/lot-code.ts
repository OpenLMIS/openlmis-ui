import type { ParseKeys } from 'i18next';
import { z } from 'zod';

const MAX_LOT_CODE_LENGTH = 20;

const LOT_CODE_CHARACTERS = /^[!"%&'()*+,\-./0-9:;<=>?A-Z_a-z]*$/;

export type LotCodeMessages = {
  required: ParseKeys;
  tooLong: ParseKeys;
  invalid: ParseKeys;
};

export function lotCodeSchema(messages: LotCodeMessages) {
  return z
    .string()
    .refine((code) => code.trim().length > 0, messages.required)
    .refine((code) => code.length <= MAX_LOT_CODE_LENGTH, messages.tooLong)
    .refine((code) => LOT_CODE_CHARACTERS.test(code), messages.invalid);
}

export const sameLotCode = (first: string, second: string) =>
  first.toLowerCase() === second.toLowerCase();
