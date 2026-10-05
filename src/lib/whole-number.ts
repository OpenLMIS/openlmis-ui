import type { ParseKeys } from 'i18next';
import { z } from 'zod';

const MAX_WHOLE_NUMBER = 2_147_483_647;

const ARABIC_INDIC_ZERO = 0x0660;
const PERSIAN_ZERO = 0x06f0;

export function toLatinDigits(text: string) {
  return text.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_INDIC_ZERO));
  });
}

type WholeNumberMessages = {
  required?: ParseKeys;
  invalid: ParseKeys;
  tooLarge: ParseKeys;
};

type WholeNumberRange = {
  min?: { value: number; tooSmall: ParseKeys } | undefined;
  max?: number;
  optional?: boolean;
};

export function wholeNumberText(
  messages: WholeNumberMessages,
  { min, max = MAX_WHOLE_NUMBER, optional = false }: WholeNumberRange = {},
) {
  return z.string().superRefine((value, context) => {
    const text = toLatinDigits(value.trim());
    if (!text) {
      if (!optional) {
        context.addIssue({ code: 'custom', message: messages.required ?? messages.invalid });
      }
    } else if (!/^[0-9]+$/.test(text))
      context.addIssue({ code: 'custom', message: messages.invalid });
    else if (Number(text) > max) context.addIssue({ code: 'custom', message: messages.tooLarge });
    else if (min && Number(text) < min.value) {
      context.addIssue({ code: 'custom', message: min.tooSmall });
    }
  });
}

export function toWholeNumber(text: string) {
  return Number(toLatinDigits(text.trim()));
}

export function toOptionalWholeNumber(text: string) {
  return text.trim() ? toWholeNumber(text) : null;
}
