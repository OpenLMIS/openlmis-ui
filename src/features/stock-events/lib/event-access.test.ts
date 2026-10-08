import { describe, expect, it } from 'vitest';
import { canReverseEvent } from '@/features/stock-events/lib/event-access';
import { parsePermissions } from '@/lib/permissions';

describe('canReverseEvent', () => {
  it.each([
    [true, ['STOCK_EVENTS_CANCEL|facility|program'], true],
    [false, ['STOCK_EVENTS_CANCEL|facility|program'], false],
    [null, ['STOCK_EVENTS_CANCEL|facility|program'], false],
    [undefined, ['STOCK_EVENTS_CANCEL|facility|program'], false],
    [true, ['STOCK_EVENTS_CANCEL'], false],
    [true, ['STOCK_EVENTS_CANCEL|other|program'], false],
    [true, ['STOCK_EVENTS_CANCEL|facility|other'], false],
    [true, ['STOCK_CARDS_VIEW|facility|program'], false],
  ])('requires reversible=%s and the exact cancel grant %j', (reversible, grants, expected) => {
    expect(
      canReverseEvent(
        parsePermissions(grants),
        {
          id: 'event',
          facilityId: 'facility',
          programId: 'program',
          reversible,
        },
        'STOCK_EVENTS_CANCEL',
      ),
    ).toBe(expected);
  });
});
