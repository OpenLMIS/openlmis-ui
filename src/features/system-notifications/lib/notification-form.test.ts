import { describe, expect, it } from 'vitest';
import {
  EMPTY_NOTIFICATION_FORM,
  notificationFormSchema,
  toFormValues,
  toPayload,
} from '@/features/system-notifications/lib/notification-form';
import type { SavedNotification } from '@/features/system-notifications/lib/types';

const utc = 'UTC';
const authorId = 'author';
const draft = { ...EMPTY_NOTIFICATION_FORM, message: 'Maintenance tonight' };
const saved: SavedNotification = {
  id: 'notice',
  author: { id: authorId },
  createdDate: '2026-01-01T12:34:56.123456Z',
  message: 'Maintenance tonight',
  title: null,
  active: true,
  startDate: '2026-01-01T12:00:30.000Z',
  expiryDate: '2026-01-01T12:01:59.999Z',
};

describe('notification form', () => {
  it('refuses a blank message and a typed invalid date', () => {
    const schema = notificationFormSchema(utc);
    expect(schema.safeParse({ ...draft, message: ' \n ' }).error?.issues).toMatchObject([
      { path: ['message'] },
    ]);
    expect(
      schema.safeParse({ ...draft, startDate: '2026-02-30', startTime: '01:00' }).error?.issues,
    ).toMatchObject([{ path: ['startDate'] }]);
  });

  it('validates the actual instants and allows equal bounds', () => {
    const schema = notificationFormSchema(utc, saved);
    const values = toFormValues(saved, utc);
    expect(schema.safeParse({ ...values, expiryTime: '11:59' }).error?.issues).toMatchObject([
      { path: ['expiryDate'] },
    ]);
    expect(schema.safeParse({ ...values, expiryTime: '12:00' }).success).toBe(true);
    const equal = { ...saved, expiryDate: saved.startDate };
    expect(notificationFormSchema(utc, equal).safeParse(toFormValues(equal, utc)).success).toBe(
      true,
    );
  });

  it('compares a retained later DST occurrence with the earlier occurrence used for edits', () => {
    const zone = 'Europe/Warsaw';
    const repeated = {
      ...saved,
      startDate: '2026-10-25T01:00:30Z',
      expiryDate: '2026-10-25T01:01:59Z',
    };
    const result = notificationFormSchema(zone, repeated).safeParse({
      ...toFormValues(repeated, zone),
      expiryTime: '02:00',
    });
    expect(result.error?.issues).toMatchObject([{ path: ['expiryDate'] }]);
  });

  it('echoes the saved bounds, author and created date, and includes the PUT id', () => {
    expect(toPayload(toFormValues(saved, utc), utc, authorId, saved)).toEqual({
      ...saved,
      author: { id: authorId },
    });
  });

  it('sends cleared bounds as null and omits server-owned fields on Add', () => {
    expect(toPayload(draft, utc, authorId, saved)).toMatchObject({
      startDate: null,
      expiryDate: null,
    });
    expect(toPayload(draft, utc, authorId)).toEqual({
      active: true,
      author: { id: authorId },
      message: draft.message,
      startDate: null,
      expiryDate: null,
      title: null,
    });
  });
});
