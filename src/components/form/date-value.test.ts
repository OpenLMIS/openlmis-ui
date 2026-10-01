import { describe, expect, it } from 'vitest';
import { formatDateValue, parseDateValue, toDateValue } from '@/components/form/date-value';

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
  });

  it('shows nothing for no date', () => {
    expect(formatDateValue('', 'en-US')).toBe('');
  });
});
