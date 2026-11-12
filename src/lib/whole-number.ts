import type { ParseKeys } from 'i18next';
import { z } from 'zod';

export const MAX_WHOLE_NUMBER = 2_147_483_647;

const ARABIC_INDIC_ZERO = 0x0660;
const PERSIAN_ZERO = 0x06f0;

export function toLatinDigits(text: string) {
  return text.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_INDIC_ZERO));
  });
}

type WholeNumberMessages<K extends ParseKeys = ParseKeys> = {
  required?: K;
  invalid: K;
  tooLarge: K;
};

type WholeNumberRange<K extends ParseKeys = ParseKeys> = {
  min?: { value: number; tooSmall: K } | undefined;
  max?: number;
  optional?: boolean;
};

export function wholeNumberError<K extends ParseKeys>(
  value: string,
  messages: WholeNumberMessages<K>,
  { min, max = MAX_WHOLE_NUMBER, optional = false }: WholeNumberRange<K> = {},
): K | undefined {
  const text = toLatinDigits(value.trim());
  if (!text) return optional ? undefined : (messages.required ?? messages.invalid);
  if (!/^[0-9]+$/.test(text)) return messages.invalid;
  if (Number(text) > max) return messages.tooLarge;
  if (min && Number(text) < min.value) return min.tooSmall;
  return undefined;
}

export function wholeNumberText(messages: WholeNumberMessages, range: WholeNumberRange = {}) {
  return z.string().superRefine((value, context) => {
    const message = wholeNumberError(value, messages, range);
    if (message) context.addIssue({ code: 'custom', message });
  });
}

export function toWholeNumber(text: string) {
  return Number(toLatinDigits(text.trim()));
}

export function toOptionalWholeNumber(text: string) {
  return text.trim() ? toWholeNumber(text) : null;
}
