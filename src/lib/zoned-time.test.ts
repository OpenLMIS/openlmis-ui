import { describe, expect, it } from 'vitest';
import { fromZonedParts, toZonedParts } from '@/lib/zoned-time';

const zone = 'Europe/Warsaw';

describe('deployment wall time', () => {
  it('round-trips a summer time across the UTC date boundary', () => {
    const instant = '2026-07-01T22:15:00.000Z';
    expect(toZonedParts(instant, zone)).toEqual({ date: '2026-07-02', time: '00:15' });
    expect(fromZonedParts('2026-07-02', '00:15', zone)).toBe(instant);
  });

  it('refuses a skipped time and takes the earlier occurrence of a repeated time', () => {
    expect(fromZonedParts('2026-03-29', '02:30', zone)).toBeNull();
    expect(fromZonedParts('2026-10-25', '02:30', zone)).toBe('2026-10-25T00:30:00.000Z');
  });

  it('includes the entire expiry minute', () => {
    expect(fromZonedParts('2026-01-01', '12:00', zone, { endOfMinute: true })).toBe(
      '2026-01-01T11:00:59.999Z',
    );
  });
});
