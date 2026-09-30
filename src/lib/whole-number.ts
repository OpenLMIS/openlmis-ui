import type { ParseKeys } from 'i18next';
import { z } from 'zod';

export const MAX_WHOLE_NUMBER = 2_147_483_647;

type WholeNumberMessages = {
  required: ParseKeys;
  invalid: ParseKeys;
  tooLarge: ParseKeys;
};

export function wholeNumberText(messages: WholeNumberMessages) {
  return z
    .string()
    .trim()
    .superRefine((text, context) => {
      if (!text) context.addIssue({ code: 'custom', message: messages.required });
      else if (!/^\d+$/.test(text)) context.addIssue({ code: 'custom', message: messages.invalid });
      else if (Number(text) > MAX_WHOLE_NUMBER) {
        context.addIssue({ code: 'custom', message: messages.tooLarge });
      }
    })
    .transform(Number);
}
