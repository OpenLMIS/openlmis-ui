import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import { toLatinDigits } from '@/lib/whole-number';

const ARABIC_DECIMAL_SEPARATOR = /٫/g;

const toLatinNumber = (text: string) =>
  toLatinDigits(text.trim()).replace(ARABIC_DECIMAL_SEPARATOR, '.');

type DecimalMessages = {
  required?: ParseKeys;
  invalid: ParseKeys;
  tooLarge: ParseKeys;
  tooPrecise?: ParseKeys;
};

type DecimalRules = {
  optional?: boolean;
  maxDecimals?: number;
  max?: number;
};

export function decimalText(
  messages: DecimalMessages,
  { optional = false, maxDecimals, max = Number.MAX_SAFE_INTEGER }: DecimalRules = {},
) {
  return z.string().superRefine((value, context) => {
    const text = toLatinNumber(value);
    const issue = (message: ParseKeys | undefined) =>
      context.addIssue({ code: 'custom', message: message ?? messages.invalid });
    if (!text) {
      if (!optional) issue(messages.required);
    } else if (!/^[0-9]+(\.[0-9]+)?$/.test(text)) issue(messages.invalid);
    else if (Number(text) > max) issue(messages.tooLarge);
    else if (maxDecimals !== undefined && (text.split('.')[1]?.length ?? 0) > maxDecimals) {
      issue(messages.tooPrecise);
    }
  });
}

export function toDecimal(text: string) {
  const latin = toLatinNumber(text);
  return latin ? Number(latin) : null;
}
