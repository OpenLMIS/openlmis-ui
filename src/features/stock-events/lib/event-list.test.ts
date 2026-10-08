import { describe, expect, it } from 'vitest';
import { eventTypeKey } from '@/features/stock-events/lib/event-list';

describe('event list labels', () => {
  it('names each recorded type and leaves an old event without one blank', () => {
    expect(eventTypeKey('ISSUE')).toBe('transaction-history.type-issue');
    expect(eventTypeKey('RECEIVE')).toBe('transaction-history.type-receive');
    expect(eventTypeKey('ADJUSTMENT')).toBe('transaction-history.type-adjustment');
    expect(eventTypeKey('issue')).toBe('transaction-history.type-issue');
    expect(eventTypeKey(null)).toBeUndefined();
  });
});
