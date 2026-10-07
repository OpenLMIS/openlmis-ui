import { describe, expect, it } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import type { Reason } from '@/features/reference-data/lib/types';
import { newAdjustmentLine } from '@/features/stock-events/lib/adjustment-form';
import { filterAdjustmentLines, pageOf } from '@/features/stock-events/lib/line-filter';

const row = {
  ...newAdjustmentLine(
    {
      stockOnHand: 50,
      orderable: {
        id: 'p1',
        productCode: 'C1',
        fullProductName: 'Acetylsalicylic Acid',
        netContent: 16,
        dispensable: { displayUnit: '10 tab strip' },
      },
      lot: { id: 'l1', lotCode: 'LC2017A', expirationDate: '2019-01-30' },
    },
    undefined,
    '2026-10-07',
  ),
  reasonId: 'lost',
  reasonFreeText: 'Research Only',
  quantity: quantityValue('25', 16),
};
const reasons: Reason[] = [
  {
    id: 'lost',
    name: 'Lost stock',
    reasonType: 'DEBIT',
    reasonCategory: 'ADJUSTMENT',
    isFreeTextAllowed: true,
    tags: [],
  },
];
const formatDate = (date: string) => date.split('-').reverse().join('/');
const other = {
  ...row,
  key: 'other',
  orderable: { ...row.orderable, productCode: 'G2', fullProductName: null, dispensable: {} },
  stockOnHand: 0,
  lot: null,
  reasonId: '',
  reasonFreeText: '',
  quantity: quantityValue(),
  occurredDate: '',
};
const filter = (keyword: string) =>
  filterAdjustmentLines([row, other], keyword, reasons, formatDate);

describe('filterAdjustmentLines', () => {
  it.each([
    ' c1 ',
    'aCeTyL',
    '10 tab strip',
    '50',
    'LOST STOCK',
    'research',
    '25',
    'lc2017a',
    '30/01/2019',
    '07/10/2026',
  ])('matches the legacy searchable value %s with trimming and case folding', (keyword) => {
    expect(filter(keyword)).toEqual([row]);
  });
  it('matches numeric zero, handles missing optional values, and does not match unformatted dates', () => {
    expect(filter('g2')).toEqual([other]);
    expect(filter('0')).toContain(other);
    expect(filter('2019-01-30')).toEqual([]);
    expect(filter('no matches')).toEqual([]);
  });
  it('keeps draft order and all lines for an empty keyword without changing them', () => {
    expect(filter('  ')).toEqual([row, other]);
    expect(filterAdjustmentLines([], 'x', reasons, formatDate)).toEqual([]);
    expect(filter('c1')[0]).toBe(row);
  });
  it('uses the supplied page-language date formatter', () => {
    expect(filterAdjustmentLines([row], 'localized', reasons, () => 'localized date')).toEqual([
      row,
    ]);
  });
});

describe('pageOf', () => {
  it('maps zero-based line indexes to the one-based page used by table search', () => {
    expect([0, 9, 10, 19, 20].map((index) => pageOf(index, 10))).toEqual([1, 1, 2, 2, 3]);
  });
});
