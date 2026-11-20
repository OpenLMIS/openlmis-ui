import { describe, expect, it } from 'vitest';
import { dateValue } from '@/lib/date-value';

describe('dateValue', () => {
  it('accepts canonical days and optional blanks, and rejects invalid text and years', () => {
    const schema = dateValue({ optional: true });
    expect(schema.safeParse('').success).toBe(true);
    expect(schema.safeParse('2024-02-29').success).toBe(true);
    for (const value of ['29/02/2024', '2025-02-29', '9999-01-01']) {
      expect(schema.safeParse(value).error?.issues[0]?.message).toBe('form.date-invalid');
    }
    expect(dateValue().safeParse('').success).toBe(false);
  });
});
