import { z } from 'zod';
import { isEditableDateValue } from '@/components/form/date-value';

export function dateValue({
  optional = false,
  required = 'form.date-invalid',
  invalid = 'form.date-invalid',
}: {
  optional?: boolean;
  required?: string;
  invalid?: string;
} = {}) {
  return z.string().superRefine((value, context) => {
    const message =
      value === ''
        ? optional
          ? undefined
          : required
        : !isEditableDateValue(value)
          ? invalid
          : undefined;
    if (message) context.addIssue({ code: 'custom', message });
  });
}
