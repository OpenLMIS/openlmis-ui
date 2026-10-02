import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import { toLatinDigits } from '@/lib/whole-number';

const DECIMAL_MARKS = /^([0-9]+)[,٫]([0-9]+)$/;

const toLatinNumber = (text: string) => toLatinDigits(text.trim()).replace(DECIMAL_MARKS, '$1.$2');

type DecimalMessages = {
  required?: ParseKeys;
  invalid: ParseKeys;
  tooLarge: ParseKeys;
  tooPrecise?: ParseKeys;
};

type DecimalRules = {
  optional?: boolean;
  maxDecimals?: number;
};

export function decimalText(
  messages: DecimalMessages,
  { optional = false, maxDecimals }: DecimalRules = {},
) {
  return z.string().superRefine((value, context) => {
    const text = toLatinNumber(value);
    const issue = (message: ParseKeys | undefined) =>
      context.addIssue({ code: 'custom', message: message ?? messages.invalid });
    if (!text) {
      if (!optional) issue(messages.required);
    } else if (!/^[0-9]+(\.[0-9]+)?$/.test(text)) issue(messages.invalid);
    else if (Number(text) > Number.MAX_SAFE_INTEGER) issue(messages.tooLarge);
    else if (maxDecimals !== undefined && (text.split('.')[1]?.length ?? 0) > maxDecimals) {
      issue(messages.tooPrecise);
    }
  });
}

export function toDecimal(text: string) {
  const latin = toLatinNumber(text);
  return latin ? Number(latin) : null;
}

export const toNumberText = (value: number | null | undefined) =>
  value == null ? '' : String(value);
