import type { ParseKeys } from 'i18next';
import { z } from 'zod';

const MAX_WHOLE_NUMBER = 2_147_483_647;

const ARABIC_INDIC_ZERO = 0x0660;
const PERSIAN_ZERO = 0x06f0;

function toLatinDigits(text: string) {
  return text.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_INDIC_ZERO));
  });
}

type WholeNumberMessages = {
  required: ParseKeys;
  invalid: ParseKeys;
  tooLarge: ParseKeys;
};

export function wholeNumberText(messages: WholeNumberMessages) {
  return z.string().superRefine((value, context) => {
    const text = toLatinDigits(value.trim());
    if (!text) context.addIssue({ code: 'custom', message: messages.required });
    else if (!/^[0-9]+$/.test(text))
      context.addIssue({ code: 'custom', message: messages.invalid });
    else if (Number(text) > MAX_WHOLE_NUMBER) {
      context.addIssue({ code: 'custom', message: messages.tooLarge });
    }
  });
}

export function toWholeNumber(text: string) {
  return Number(toLatinDigits(text.trim()));
}
