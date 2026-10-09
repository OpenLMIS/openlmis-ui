import { describe, expect, it } from 'vitest';
import { resolveColumnVisibility } from '@/components/data-table/responsive-columns';
import {
  EVENT_HIDEABLE_COLUMNS,
  eventHideableColumns,
} from '@/features/stock-events/components/event-line-table';

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

it('keeps only the four optional Issue columns in View, in hiding priority order', () => {
  expect(eventHideableColumns('issue').map(({ id }) => id)).toEqual([
    'productCode',
    'packSize',
    'total',
    'expiry',
  ]);
});

it.each(['DOSES', 'PACKS'] as const)(
  'keeps identifying and editable Issue columns on in %s',
  (unit) => {
    for (const hasLots of [false, true]) {
      const columns = eventHideableColumns('issue', { hasLots, unit });
      for (const width of [341, 703, 959, 1102]) {
        const visibility = resolveColumnVisibility(columns, {}, width);
        for (const id of [
          'product',
          'stockOnHand',
          'lotCode',
          'destination',
          'destinationComments',
          'reason',
          'comments',
          'quantity',
          'date',
          'actions',
        ])
          expect(visibility[id]).toBeUndefined();
      }
    }
  },
);

it('lets View restore all optional Issue columns on a phone', () => {
  const columns = eventHideableColumns('issue');
  const choices = Object.fromEntries(columns.map(({ id }) => [id, true]));
  expect(resolveColumnVisibility(columns, choices, 341)).toEqual(choices);
});

it.each([
  [true, 'PACKS', [1882, 1769, 1693, 1576]],
  [true, 'DOSES', [1733, 1620, 1544, 1544]],
  [false, 'PACKS', [1700, 1587, 1511, 1394]],
  [false, 'DOSES', [1551, 1438, 1362, 1362]],
] as const)('uses measured Issue budgets with lots %s in %s', (hasLots, unit, thresholds) => {
  const columns = eventHideableColumns('issue', { hasLots, unit });
  expect(columns.map(({ hideBelow }) => hideBelow)).toEqual(thresholds);
  for (const { id, hideBelow } of columns) {
    expect(resolveColumnVisibility(columns, {}, hideBelow - 1)[id]).toBe(false);
    expect(resolveColumnVisibility(columns, {}, hideBelow)[id]).toBe(true);
  }
});
