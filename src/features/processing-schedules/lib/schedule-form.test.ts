import { expect, it } from 'vitest';
import {
  duplicateField,
  EMPTY_SCHEDULE_FORM,
  scheduleFormSchema,
  toScheduleBody,
} from '@/features/processing-schedules/lib/schedule-form';
import { httpError } from '@/tests/http-error';

it('requires code and name including whitespace-only values', () => {
  const result = scheduleFormSchema([]).safeParse({
    ...EMPTY_SCHEDULE_FORM,
    code: ' ',
    name: '  ',
  });
  expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
    ['code', 'processing-schedules.form.code-required'],
    ['name', 'processing-schedules.form.name-required'],
  ]);
});

it('trims values and omits a blank description from the body', () => {
  const values = { code: ' M ', name: ' Monthly ', description: '  ' };
  expect(scheduleFormSchema([]).parse(values)).toEqual({
    code: 'M',
    name: 'Monthly',
    description: '',
  });
  expect(toScheduleBody(values)).toEqual({ code: 'M', name: 'Monthly' });
  expect(toScheduleBody({ ...values, description: ' Run ' }).description).toBe('Run');
});

it('refuses lookup and server-refused fields ignoring case and spaces', () => {
  const schema = scheduleFormSchema(
    [{ id: 's1', code: ' M ', name: ' Monthly ' }],
    [{ code: ' Q ', name: '' }],
  );
  for (const code of ['m', ' q ']) {
    const result = schema.safeParse({ code, name: ' monthly ', description: '' });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['code', 'name']);
  }
});

it('maps server duplicate keys to their fields only', () => {
  for (const field of ['code', 'name']) {
    expect(
      duplicateField(
        httpError(400, {
          messageKey: `referenceData.error.processingSchedule.${field}.duplicated`,
        }),
      ),
    ).toBe(field);
  }
  expect(duplicateField(httpError(400, { messageKey: 'other' }))).toBeUndefined();
  expect(duplicateField(new Error('offline'))).toBeUndefined();
});
