import { z } from 'zod';
import type {
  DigestConfiguration,
  DigestSubscription,
  NotificationChannel,
} from '@/features/profile/lib/types';

export type Frequency = 'daily' | 'weekly' | 'custom';

/** A schedule as the form edits it; `weekday` is Sunday 0 to Saturday 6, as in cron. */
type Schedule = {
  frequency: Frequency;
  weekday: string;
  time: string;
  cron: string;
};

export type DigestRow = {
  configurationId: string;
  tag: string;
  channel: NotificationChannel;
  useDigest: boolean;
  schedule: Schedule;
};

export const WEEKDAYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

// Seconds, minutes, hours, day of month, month, day of week: the Spring cron the server reads.
const SIMPLE_CRON = /^0 (\d{1,2}) (\d{1,2}) \* \* (\*|[0-6])$/;
const CRON_FIELD = /^[\dA-Za-z*?/,#-]+$/;
const TIME = /^(\d{2}):(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

/** Daily or weekly at a time when the expression is that simple, otherwise custom. */
export function parseSchedule(cron: string | null | undefined): Schedule {
  if (!cron) return { frequency: 'daily', weekday: '0', time: '08:00', cron: '' };
  const [, minute, hour, weekday] = SIMPLE_CRON.exec(cron) ?? [];
  if (!minute || !hour || !weekday || Number(minute) > 59 || Number(hour) > 23) {
    return { frequency: 'custom', weekday: '0', time: '08:00', cron };
  }
  return {
    frequency: weekday === '*' ? 'daily' : 'weekly',
    weekday: weekday === '*' ? '0' : weekday,
    time: `${pad(Number(hour))}:${pad(Number(minute))}`,
    cron,
  };
}

export function toCron({ frequency, weekday, time, cron }: Schedule): string {
  if (frequency === 'custom') return cron.trim();
  const [, hour = '0', minute = '0'] = TIME.exec(time) ?? [];
  return `0 ${Number(minute)} ${Number(hour)} * * ${frequency === 'daily' ? '*' : weekday}`;
}

/** Six fields of cron characters; the server checks the values themselves. */
export function isValidCron(cron: string): boolean {
  const fields = cron.trim().split(/\s+/);
  return fields.length === 6 && fields.every((field) => CRON_FIELD.test(field));
}

/** `requisition-actionRequired` as "Requisition - Action Required". */
export function tagLabel(tag: string): string {
  return tag
    .split('-')
    .map((part) =>
      part
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()),
    )
    .join(' - ');
}

/** One row per configuration; one the user never subscribed to is email without a digest. */
export function toDigestRows(
  configurations: DigestConfiguration[],
  subscriptions: DigestSubscription[],
): DigestRow[] {
  const byId = new Map(subscriptions.map((item) => [item.digestConfiguration.id, item]));
  return configurations.map(({ id, tag }) => {
    const subscription = byId.get(id);
    return {
      configurationId: id,
      tag,
      channel: subscription?.preferredChannel ?? 'EMAIL',
      useDigest: subscription?.useDigest ?? false,
      schedule: parseSchedule(subscription?.cronExpression),
    };
  });
}

export function toSubscriptions(rows: DigestRow[]): DigestSubscription[] {
  return rows.map(({ configurationId, channel, useDigest, schedule }) => ({
    digestConfiguration: { id: configurationId },
    preferredChannel: channel,
    useDigest,
    ...(useDigest && { cronExpression: toCron(schedule) }),
  }));
}

/** How many notifications would save differently from how they were loaded. */
export function countDigestChanges(saved: DigestRow[], rows: DigestRow[]): number {
  const before = toSubscriptions(saved).map((item) => JSON.stringify(item));
  return toSubscriptions(rows).filter((item, index) => JSON.stringify(item) !== before[index])
    .length;
}

const scheduleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'custom']),
  weekday: z.string(),
  time: z.string(),
  cron: z.string(),
});

const rowSchema = z
  .object({
    configurationId: z.string(),
    tag: z.string(),
    channel: z.enum(['EMAIL', 'SMS']),
    useDigest: z.boolean(),
    schedule: scheduleSchema,
  })
  .superRefine(({ useDigest, channel, schedule }, context) => {
    if (!useDigest) return;
    if (channel !== 'EMAIL') {
      context.addIssue({
        code: 'custom',
        path: ['channel'],
        message: 'profile.notifications.digest-email-only',
      });
    }
    if (schedule.frequency === 'custom') {
      if (!isValidCron(schedule.cron)) {
        context.addIssue({
          code: 'custom',
          path: ['schedule', 'cron'],
          message: 'profile.notifications.cron-invalid',
        });
      }
    } else if (!TIME.test(schedule.time)) {
      context.addIssue({
        code: 'custom',
        path: ['schedule', 'time'],
        message: 'profile.notifications.time-required',
      });
    }
  });

export const digestFormSchema = z.object({ rows: z.array(rowSchema) });
