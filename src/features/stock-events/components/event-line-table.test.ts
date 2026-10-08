import { describe, expect, it } from 'vitest';
import { resolveColumnVisibility } from '@/components/data-table/responsive-columns';
import { EVENT_HIDEABLE_COLUMNS } from '@/features/stock-events/components/event-line-table';

describe('event line column defaults', () => {
  it.each([358, 736, 1000, 1104])('reserves editable cells at %i px of content', (width) => {
    expect(resolveColumnVisibility(EVENT_HIDEABLE_COLUMNS, {}, width)).toEqual({
      productCode: false,
      packSize: false,
      expiry: false,
      total: false,
    });
  });

  it.each([
    ['total', 1150],
    ['expiry', 1250],
    ['packSize', 1400],
    ['productCode', 1500],
  ])('restores %s only when its width budget fits', (id, threshold) => {
    expect(resolveColumnVisibility(EVENT_HIDEABLE_COLUMNS, {}, threshold - 1)[id]).toBe(false);
    expect(resolveColumnVisibility(EVENT_HIDEABLE_COLUMNS, {}, threshold)[id]).toBe(true);
  });

  it('keeps every read-only column available as a user choice at any width', () => {
    const choices = { productCode: true, packSize: true, expiry: true, total: true };
    expect(resolveColumnVisibility(EVENT_HIDEABLE_COLUMNS, choices, 358)).toEqual(choices);
  });
});
