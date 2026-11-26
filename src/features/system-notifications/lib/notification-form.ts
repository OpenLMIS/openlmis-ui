import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import { isEditableDateValue } from '@/components/form/date-value';
import type {
  NotificationPayload,
  NotificationUpdate,
  SavedNotification,
} from '@/features/system-notifications/lib/types';
import { dateValue } from '@/lib/date-value';
import { fromZonedParts, toZonedParts } from '@/lib/zoned-time';

const errorKey = (key: ParseKeys) => key;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const optionalDate = dateValue({ optional: true });

export const TITLE_MAX = 255;
export const NONEXISTENT_TIME = 'system-notifications.admin.nonexistent-time';

export const NOTIFICATION_FIELD_ERRORS = {
  'referenceData.error.systemNotification.message.required': {
    field: 'message',
    key: 'system-notifications.admin.message-required',
  },
  'referenceData.error.systemNotification.startDate.after.expiryDate': {
    field: 'expiryDate',
    key: 'system-notifications.admin.expiry-before-start',
  },
} as const;

const formFields = z.object({
  active: z.boolean(),
  message: z.string().refine((text) => text.trim().length > 0, {
    message: errorKey('system-notifications.admin.message-required'),
  }),
  title: z.string().max(TITLE_MAX, errorKey('system-notifications.admin.title-too-long')),
  startDate: optionalDate,
  startTime: z.string(),
  expiryDate: optionalDate,
  expiryTime: z.string(),
});

export type NotificationFormValues = z.infer<typeof formFields>;

export const EMPTY_NOTIFICATION_FORM: NotificationFormValues = {
  active: true,
  message: '',
  title: '',
  startDate: '',
  startTime: '',
  expiryDate: '',
  expiryTime: '',
};

const BOUNDS = ['start', 'expiry'] as const;
type Bound = (typeof BOUNDS)[number];

export function toFormValues(saved: SavedNotification, zone: string): NotificationFormValues {
  const start = saved.startDate ? toZonedParts(saved.startDate, zone) : null;
  const expiry = saved.expiryDate ? toZonedParts(saved.expiryDate, zone) : null;
  return {
    active: saved.active,
    message: saved.message,
    title: saved.title ?? '',
    startDate: start?.date ?? '',
    startTime: start?.time ?? '',
    expiryDate: expiry?.date ?? '',
    expiryTime: expiry?.time ?? '',
  };
}

function boundInstant(
  bound: Bound,
  values: NotificationFormValues,
  zone: string,
  saved?: SavedNotification,
) {
  const dateField = `${bound}Date` as const;
  const date = values[dateField];
  const time = values[`${bound}Time`];
  if (!date) return null;
  const original = saved?.[dateField];
  if (original) {
    const parts = toZonedParts(original, zone);
    if (parts.date === date && parts.time === time) return original;
  }
  return fromZonedParts(date, time, zone, { endOfMinute: bound === 'expiry' });
}

function subMilliseconds(instant: string) {
  const fraction = /\.\d{3}(\d+)(?:Z|[+-])/i.exec(instant)?.[1] ?? '';
  return fraction.padEnd(6, '0');
}

function expiresBeforeStart(expiry: string, start: string) {
  const difference = Date.parse(expiry) - Date.parse(start);
  return difference === 0 ? subMilliseconds(expiry) < subMilliseconds(start) : difference < 0;
}

export function notificationFormSchema(zone: string, saved?: SavedNotification) {
  return formFields.superRefine((values, context) => {
    const validate = (bound: Bound) => {
      const date = values[`${bound}Date`];
      if (!date || !isEditableDateValue(date)) return null;
      const timeField = `${bound}Time` as const;
      if (!TIME.test(values[timeField])) {
        context.addIssue({
          code: 'custom',
          path: [timeField],
          message: errorKey('system-notifications.admin.time-invalid'),
        });
        return null;
      }
      const instant = boundInstant(bound, values, zone, saved);
      if (!instant) {
        context.addIssue({
          code: 'custom',
          path: [timeField],
          message: errorKey(NONEXISTENT_TIME),
        });
      }
      return instant;
    };
    const start = validate('start');
    const expiry = validate('expiry');
    if (start && expiry && expiresBeforeStart(expiry, start)) {
      context.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: errorKey('system-notifications.admin.expiry-before-start'),
      });
    }
  });
}

export function toPayload(
  values: NotificationFormValues,
  zone: string,
  authorId: string,
): NotificationPayload;
export function toPayload(
  values: NotificationFormValues,
  zone: string,
  authorId: string,
  saved: SavedNotification,
): NotificationUpdate;
export function toPayload(
  values: NotificationFormValues,
  zone: string,
  authorId: string,
  saved?: SavedNotification,
): NotificationPayload | NotificationUpdate {
  return {
    author: { id: saved?.author.id ?? authorId },
    title: values.title || null,
    message: values.message,
    active: values.active,
    startDate: boundInstant('start', values, zone, saved),
    expiryDate: boundInstant('expiry', values, zone, saved),
    ...(saved && { id: saved.id, createdDate: saved.createdDate }),
  };
}
