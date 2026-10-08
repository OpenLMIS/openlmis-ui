import { describe, expect, it } from 'vitest';
import { eventTypeKey, formatEventDay } from '@/features/stock-events/lib/event-list';

describe('event list labels', () => {
  it('names each recorded type and leaves an old event without one blank', () => {
    expect(eventTypeKey('ISSUE')).toBe('transaction-history.type-issue');
    expect(eventTypeKey('RECEIVE')).toBe('transaction-history.type-receive');
    expect(eventTypeKey('ADJUSTMENT')).toBe('transaction-history.type-adjustment');
    expect(eventTypeKey('issue')).toBe('transaction-history.type-issue');
    expect(eventTypeKey(null)).toBeUndefined();
  });

  it('shows the day an event was recorded in the page language', () => {
    expect(formatEventDay('2026-10-07T10:15:00Z', 'en')).toBe('Oct 7, 2026');
    expect(formatEventDay('2026-10-07T10:15:00Z', 'fr')).toBe('7 oct. 2026');
    expect(formatEventDay(null, 'en')).toBe('');
    expect(formatEventDay('not a date', 'en')).toBe('');
  });
});
