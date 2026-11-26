import { z } from 'zod';
import { type DateValueMode, isEditableDateValue } from '@/components/form/date-value';

export function dateValue({
  optional = false,
  mode = 'local',
  required = 'form.date-invalid',
  invalid = 'form.date-invalid',
}: {
  optional?: boolean;
  mode?: DateValueMode;
  required?: string;
  invalid?: string;
} = {}) {
  return z.string().superRefine((value, context) => {
    const message =
      value === ''
        ? optional
          ? undefined
          : required
        : !isEditableDateValue(value, mode)
          ? invalid
          : undefined;
    if (message) context.addIssue({ code: 'custom', message });
  });
}
