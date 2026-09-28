import { describe, expect, it } from 'vitest';
import {
  countDigestChanges,
  digestFormSchema,
  isValidCron,
  parseSchedule,
  tagLabel,
  toCron,
  toDigestRows,
  toSubscriptions,
} from '@/features/profile/lib/digest';
import type { DigestConfiguration, DigestSubscription } from '@/features/profile/lib/types';

describe('parseSchedule', () => {
  it('reads a daily and a weekly schedule', () => {
    expect(parseSchedule('0 30 8 * * *')).toEqual({
      frequency: 'daily',
      weekday: '0',
      time: '08:30',
      cron: '0 30 8 * * *',
    });
    expect(parseSchedule('0 5 17 * * 3')).toMatchObject({
      frequency: 'weekly',
      weekday: '3',
      time: '17:05',
    });
  });

  it('keeps anything else as a custom schedule, as typed', () => {
    expect(parseSchedule('0 0/5 * * * *')).toMatchObject({
      frequency: 'custom',
      cron: '0 0/5 * * * *',
    });
    expect(parseSchedule('0 0 25 * * *').frequency).toBe('custom');
  });

  it('starts a missing schedule daily at 08:00', () => {
    expect(parseSchedule(undefined)).toEqual({
      frequency: 'daily',
      weekday: '0',
      time: '08:00',
      cron: '',
    });
  });
});

describe('toCron', () => {
  it('builds the expression the server stores', () => {
    expect(toCron({ frequency: 'daily', weekday: '4', time: '08:30', cron: '' })).toBe(
      '0 30 8 * * *',
    );
    expect(toCron({ frequency: 'weekly', weekday: '1', time: '00:05', cron: '' })).toBe(
      '0 5 0 * * 1',
    );
    expect(toCron({ frequency: 'custom', weekday: '0', time: '', cron: ' 0 0/5 * * * * ' })).toBe(
      '0 0/5 * * * *',
    );
  });

  it('round-trips a simple schedule', () => {
    for (const cron of ['0 0 0 * * *', '0 59 23 * * 6']) {
      expect(toCron(parseSchedule(cron))).toBe(cron);
    }
  });
});

describe('isValidCron', () => {
  it('takes six fields: seconds, minutes, hours, day, month and weekday', () => {
    expect(isValidCron('0 0/5 * * * *')).toBe(true);
    expect(isValidCron('0 0 8 ? * MON-FRI')).toBe(true);
    expect(isValidCron('0 0 8 * *')).toBe(false);
    expect(isValidCron('0 0 8 * * * *')).toBe(false);
    expect(isValidCron('every day')).toBe(false);
    expect(isValidCron('')).toBe(false);
  });
});

describe('tagLabel', () => {
  it('reads a tag as words, one part per dash', () => {
    expect(tagLabel('requisition-actionRequired')).toBe('Requisition - Action Required');
    expect(tagLabel('stockout')).toBe('Stockout');
  });
});

const configurations: DigestConfiguration[] = [
  { id: 'd1', tag: 'requisition-actionRequired' },
  { id: 'd2', tag: 'order-shipped' },
];

const subscriptions: DigestSubscription[] = [
  {
    digestConfiguration: { id: 'd2' },
    preferredChannel: 'EMAIL',
    useDigest: true,
    cronExpression: '0 0 9 * * 1',
  },
];

describe('toDigestRows', () => {
  it('gives each configuration its subscription, or email without a digest', () => {
    expect(toDigestRows(configurations, subscriptions)).toEqual([
      {
        configurationId: 'd1',
        tag: 'requisition-actionRequired',
        channel: 'EMAIL',
        useDigest: false,
        schedule: parseSchedule(undefined),
      },
      {
        configurationId: 'd2',
        tag: 'order-shipped',
        channel: 'EMAIL',
        useDigest: true,
        schedule: parseSchedule('0 0 9 * * 1'),
      },
    ]);
  });
});

describe('toSubscriptions', () => {
  it('sends one entry per configuration, with a schedule only for a digest', () => {
    const rows = toDigestRows(configurations, subscriptions);
    expect(toSubscriptions(rows)).toEqual([
      { digestConfiguration: { id: 'd1' }, preferredChannel: 'EMAIL', useDigest: false },
      {
        digestConfiguration: { id: 'd2' },
        preferredChannel: 'EMAIL',
        useDigest: true,
        cronExpression: '0 0 9 * * 1',
      },
    ]);
  });
});

describe('countDigestChanges', () => {
  const rows = toDigestRows(configurations, subscriptions);

  it('counts the notifications whose saved settings differ', () => {
    expect(countDigestChanges(rows, rows)).toBe(0);
    const [first, second] = rows;
    expect(
      countDigestChanges(rows, [
        { ...first, channel: 'SMS' },
        { ...second, schedule: { ...second.schedule, time: '10:00' } },
      ]),
    ).toBe(2);
  });

  it('ignores a schedule edited while the digest is off', () => {
    const [first, second] = rows;
    expect(
      countDigestChanges(rows, [
        { ...first, schedule: { ...first.schedule, frequency: 'weekly' } },
        second,
      ]),
    ).toBe(0);
  });
});

describe('digestFormSchema', () => {
  const rows = toDigestRows(configurations, subscriptions);
  const messages = (changed: typeof rows) =>
    digestFormSchema
      .safeParse({ rows: changed })
      .error?.issues.map((issue) => [issue.path.join('.'), issue.message]);

  it('accepts the saved settings', () => {
    expect(messages(rows)).toBeUndefined();
  });

  it('sends a digest by email only', () => {
    const [first, second] = rows;
    expect(messages([first, { ...second, channel: 'SMS' }])).toEqual([
      ['rows.1.channel', 'profile.notifications.digest-email-only'],
    ]);
    expect(messages([{ ...first, channel: 'SMS' }, second])).toBeUndefined();
  });

  it('needs a time, or a valid custom expression, for a digest', () => {
    const [first, second] = rows;
    expect(messages([first, { ...second, schedule: { ...second.schedule, time: '' } }])).toEqual([
      ['rows.1.schedule.time', 'profile.notifications.time-required'],
    ]);
    expect(
      messages([
        first,
        { ...second, schedule: { ...second.schedule, frequency: 'custom', cron: 'nope' } },
      ]),
    ).toEqual([['rows.1.schedule.cron', 'profile.notifications.cron-invalid']]);
  });
});
