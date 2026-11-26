import { describe, expect, it, vi } from 'vitest';
import {
  advanceDateText,
  formatDateText,
  formatDateValue,
  formatTimestamp,
  parseDateText,
  parseDateValue,
  toDateValue,
} from '@/components/form/date-value';

describe('advanceDateText', () => {
  it.each([
    ['two-digit day', '0', '05', 'dd/MM/yyyy', '05/'],
    ['two-digit month', '05/0', '05/01', 'dd/MM/yyyy', '05/01/'],
    ['final year', '05/05/202', '05/05/2026', 'dd/MM/yyyy', '05/05/2026'],
    ['month-first padding', '', '3', 'MM/dd/yyyy', '03/'],
    ['day padding', '', '5', 'dd/MM/yyyy', '05/'],
    ['day can still start with 3', '', '3', 'dd/MM/yyyy', '3'],
    ['month can still start with 1', '05/', '05/1', 'dd/MM/yyyy', '05/1'],
    ['separator from its position', '1/0', '1/05', 'd/MM yyyy', '1/05 '],
    ['year-first format', '202', '2026', 'yyyy-MM-dd', '2026-'],
    ['single year digit', '', '5', 'yyyy-MM-dd', '5'],
    ['final day pads without a separator', '2026-05-', '2026-05-5', 'yyyy-MM-dd', '2026-05-05'],
    ['Arabic day padding', '', '٥', 'dd/MM/yyyy', '٠٥/'],
    ['Persian month padding', '٠٥/', '٠٥/۳', 'dd/MM/yyyy', '٠٥/۰۳/'],
    ['separator typed by hand', '1/', '1//', 'dd/MM/yyyy', '1//'],
    ['space', '12', '12 ', 'dd/MM/yyyy', '12 '],
    ['space after a short part', '12/7', '12/7 ', 'dd/MM/yyyy', '12/7 '],
    ['removal', '05/05', '05/5', 'dd/MM/yyyy', '05/5'],
    ['middle edit', '1/2', '15/2', 'dd/MM/yyyy', '15/2'],
    ['past the format', '05/05/2026', '05/05/20261', 'dd/MM/yyyy', '05/05/20261'],
    ['unexpected separator', '05-0', '05-05', 'dd/MM/yyyy', '05-05'],
    ['fallback format', '0', '05', 'unsupported', '05/'],
  ])('%s', (_name, previous, next, format, expected) => {
    expect(advanceDateText(previous, next, format)).toBe(expected);
  });

  it.each([
    ['same separator', '05/', '05//', 'dd/MM/yyyy', '05/'],
    ['another separator', '05/', '05/-', 'dd/MM/yyyy', '05/'],
    ['after a year', '2026-', '2026--', 'yyyy-MM-dd', '2026-'],
  ])(
    'swallows one separator typed right after an added one: %s',
    (_name, previous, next, format, expected) => {
      expect(advanceDateText(previous, next, format, true)).toBe(expected);
    },
  );
});

it('round-trips typed civil dates that the browser might have skipped', () => {
  expect(parseDateText('30/12/2011')).toBe('2011-12-30');
  expect(formatDateText('2011-12-30')).toBe('30/12/2011');
});

describe('parseDateValue', () => {
  it('reads a yyyy-MM-dd date as that day, at midnight where the user is', () => {
    const date = parseDateValue('2026-03-01');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(1);
    expect(date?.getHours()).toBe(0);
  });

  it('reads nothing from an empty or malformed value, or a day that does not exist', () => {
    expect(parseDateValue('')).toBeUndefined();
    expect(parseDateValue('01/03/2026')).toBeUndefined();
    expect(parseDateValue('2026-02-30')).toBeUndefined();
    expect(parseDateValue('2026-13-01')).toBeUndefined();
  });
});

describe('toDateValue', () => {
  it('writes the day as the user sees it, with no time zone shift', () => {
    expect(toDateValue(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDateValue(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });

  it('round-trips with parseDateValue', () => {
    const date = parseDateValue('2024-02-29');
    expect(date && toDateValue(date)).toBe('2024-02-29');
  });
});

describe('formatDateValue', () => {
  it('shows the day in the given language', () => {
    expect(formatDateValue('2026-10-01', 'en-US')).toBe('Oct 1, 2026');
    expect(formatDateValue('2026-10-01', 'pt')).toBe('1 de out. de 2026');
    expect(formatDateValue('2026-10-01', 'es')).toBe('1 oct 2026');
    expect(formatDateValue('2026-10-01', 'fr')).toBe('1 oct. 2026');
  });

  it('shows nothing for no date', () => {
    expect(formatDateValue('', 'en-US')).toBe('');
  });
});

describe('formatTimestamp', () => {
  it.each([
    ['en-US', 'Oct 8, 2026, 2:35:07 PM'],
    ['fr', '8 oct. 2026, 14:35:07'],
  ])('formats the date and time with seconds in %s', (locale, expected) => {
    expect(formatTimestamp('2026-10-08T14:35:07Z', locale, { time: true, timeZone: 'UTC' })).toBe(
      expected,
    );
  });

  it('shows the day in the given time zone, not the browser one', () => {
    expect(formatTimestamp('2026-10-08T23:30:00Z', 'en-US', { timeZone: 'UTC' })).toBe(
      'Oct 8, 2026',
    );
    expect(formatTimestamp('2026-10-08T23:30:00Z', 'en-US', { timeZone: 'Europe/Warsaw' })).toBe(
      'Oct 9, 2026',
    );
  });

  it('shows nothing for an absent or invalid timestamp', () => {
    expect(formatTimestamp(null, 'en')).toBe('');
    expect(formatTimestamp('', 'en')).toBe('');
    expect(formatTimestamp('invalid', 'en')).toBe('');
  });

  it('falls back to the browser time zone for an unknown one', () => {
    const instant = '2026-10-08T12:00:00Z';
    expect(formatTimestamp(instant, 'en-US', { timeZone: 'Mars/Base' })).toBe(
      formatTimestamp(instant, 'en-US'),
    );
  });
});

it('reuses date formatters by locale and timestamp options', () => {
  const createFormatter = vi.spyOn(Intl, 'DateTimeFormat');
  try {
    formatDateValue('2026-10-01', 'en-GB');
    formatDateValue('2026-10-02', 'en-GB');
    formatDateValue('2026-10-01', 'de');
    formatDateValue('2026-10-02', 'de');
    formatTimestamp('2026-10-01T12:00:00Z', 'en-GB', { time: 'short' });
    formatTimestamp('2026-10-02T12:00:00Z', 'en-GB', { time: 'short' });
    expect(createFormatter).toHaveBeenCalledTimes(3);
  } finally {
    createFormatter.mockRestore();
  }
});

it('uses the deployment calendar day around UTC midnight', () => {
  const instant = new Date('2026-10-28T00:30:00Z');
  expect(toDateValue(instant, 'America/Los_Angeles')).toBe('2026-10-27');
  expect(toDateValue(instant, 'Asia/Tokyo')).toBe('2026-10-28');
});

describe('editable dates', () => {
  it.each([
    ['31/12/2018', 'dd/MM/yyyy', '2018-12-31'],
    ['2024-07-02', 'yyyy-dd-MM', '2024-02-07'],
    ['2026-01-13', 'yyyy-dd-MM', undefined],
    ['7.2.2024', 'MM.dd.yyyy', '2024-07-02'],
    ['۲۰۲۴-۰۲-۲۹', 'dd/MM/yyyy', '2024-02-29'],
    ['٢٩/٢/٢٠٢٤', 'unsupported', '2024-02-29'],
    ['29/02/2025', 'dd/MM/yyyy', undefined],
    ['01/02/24', 'dd/MM/yyyy', undefined],
    ['9999-01-01', 'dd/MM/yyyy', undefined],
  ])('parses %s with %s', (text, pattern, expected) => {
    expect(parseDateText(text, pattern)).toBe(expected);
  });

  it('accepts the first and last years and rejects their adjacent years', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 13), toFake: ['Date'] });
    try {
      expect(parseDateText('01/01/1899')).toBeUndefined();
      expect(parseDateText('01/01/1900')).toBe('1900-01-01');
      expect(parseDateText('31/12/2126')).toBe('2126-12-31');
      expect(parseDateText('01/01/2127')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('formats deployment patterns and still displays a stored date outside the entry range', () => {
    expect(formatDateText('2024-02-01', 'yyyy-M-d')).toBe('2024-2-1');
    expect(formatDateText('9999-01-01', 'unsupported')).toBe('01/01/9999');
  });
});
