import { z } from 'zod';
import { parseDateValue, toDateValue } from '@/components/form/date-value';
import type {
  ProcessingPeriod,
  ProcessingPeriodBody,
  ProcessingScheduleDetail,
} from '@/features/processing-schedules/lib/types';

export function isReportOnly(extraData?: Record<string, unknown> | null) {
  return extraData?.reportOnly === true || extraData?.reportOnly === 'true';
}

function shiftDate(value: string, days: number) {
  const date = parseDateValue(value);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return toDateValue(date);
}

export const nextStartDate = (endDate: string) => shiftDate(endDate, 1);
export const previousDate = (startDate: string) => shiftDate(startDate, -1);

const dateSchema = (required: string, invalid: string) =>
  z
    .string()
    .min(1, required)
    .refine((value) => !value || !!parseDateValue(value), invalid);

export const periodFormSchema = z
  .object({
    name: z.string().trim().min(1, 'processing-schedules.period-form.name-required'),
    description: z.string().trim(),
    startDate: dateSchema(
      'processing-schedules.period-form.start-required',
      'processing-schedules.period-form.start-invalid',
    ),
    endDate: dateSchema(
      'processing-schedules.period-form.end-required',
      'processing-schedules.period-form.end-invalid',
    ),
    reportOnly: z.boolean(),
  })
  .refine(
    ({ startDate, endDate }) =>
      !parseDateValue(startDate) || !parseDateValue(endDate) || endDate > startDate,
    { path: ['endDate'], message: 'processing-schedules.period-form.end-after-start' },
  );

export type PeriodFormValues = z.infer<typeof periodFormSchema>;

export function toPeriodFormValues(latest?: ProcessingPeriod): PeriodFormValues {
  return {
    name: '',
    description: '',
    startDate: latest ? nextStartDate(latest.endDate) : '',
    endDate: '',
    reportOnly: false,
  };
}

export function toPeriodBody(
  values: PeriodFormValues,
  schedule: ProcessingScheduleDetail,
): ProcessingPeriodBody {
  const description = values.description.trim();
  return {
    processingSchedule: schedule,
    name: values.name.trim(),
    ...(description && { description }),
    startDate: values.startDate,
    endDate: values.endDate,
    ...(values.reportOnly && { extraData: { reportOnly: true } }),
  };
}

export function landingPage({ total, size, desc }: { total: number; size: number; desc: boolean }) {
  return desc ? 1 : Math.max(1, Math.ceil(total / size));
}
