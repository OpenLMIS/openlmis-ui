import { isAxiosError } from 'axios';
import { z } from 'zod';
import type { ProcessingScheduleBody } from '@/features/processing-schedules/lib/types';
import type { ProcessingSchedule } from '@/features/reference-data/lib/types';

export type TakenSchedule = Pick<ProcessingSchedule, 'code' | 'name'>;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function scheduleFormSchema(
  schedules: readonly ProcessingSchedule[],
  refused: readonly TakenSchedule[] = [],
) {
  const taken = [...schedules, ...refused];
  return z.object({
    code: z
      .string()
      .trim()
      .min(1, 'processing-schedules.form.code-required')
      .refine(
        (code) => !code || !taken.some((schedule) => same(schedule.code, code)),
        'processing-schedules.form.code-taken',
      ),
    name: z
      .string()
      .trim()
      .min(1, 'processing-schedules.form.name-required')
      .refine(
        (name) => !name || !taken.some((schedule) => same(schedule.name, name)),
        'processing-schedules.form.name-taken',
      ),
    description: z.string().trim(),
  });
}

export type ScheduleFormValues = z.infer<ReturnType<typeof scheduleFormSchema>>;

export const EMPTY_SCHEDULE_FORM: ScheduleFormValues = { code: '', name: '', description: '' };

export function toScheduleBody(values: ScheduleFormValues): ProcessingScheduleBody {
  const description = values.description.trim();
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    ...(description && { description }),
  };
}

const DUPLICATE_KEYS: Record<string, 'code' | 'name'> = {
  'referenceData.error.processingSchedule.code.duplicated': 'code',
  'referenceData.error.processingSchedule.name.duplicated': 'name',
};

export function duplicateField(error: unknown) {
  if (!isAxiosError<{ messageKey?: string }>(error)) return undefined;
  const key = error.response?.data?.messageKey;
  return key ? DUPLICATE_KEYS[key] : undefined;
}
