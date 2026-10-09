import { describe, expect, it } from 'vitest';
import {
  cancellationReasons,
  canReverseLine,
  changeReverseReason,
  lineErrorMessage,
  newStockOnHand,
  reversalReasonType,
  reversePayload,
  reverseRowId,
  validateReverse,
} from '@/features/stock-events/lib/event-reverse';
import type { StockEventLine, StockEventLineReason } from '@/features/stock-events/lib/types';

const reason = (overrides: Partial<StockEventLineReason> = {}): StockEventLineReason => ({
  id: 'reason',
  name: 'Reason',
  reasonType: 'CREDIT',
  reasonCategory: 'ADJUSTMENT',
  tags: [],
  isFreeTextAllowed: true,
  ...overrides,
});
const line = (overrides: Partial<StockEventLine> = {}): StockEventLine => ({
  stockEventLineItemId: 'line',
  orderable: { id: 'product', productCode: 'P', fullProductName: 'Product', netContent: 10 },
  lot: null,
  quantity: 5,
  occurredDate: '2026-10-01',
  stockOnHand: 10,
  reason: reason(),
  ...overrides,
});

describe('reverse line eligibility', () => {
  it.each([
    [{ destination: { name: 'Ward' } }, true],
    [{ source: { name: 'Warehouse' } }, true],
    [{}, true],
    [{ reason: reason({ reasonCategory: 'PHYSICAL_INVENTORY' }) }, false],
    [{ reason: null }, false],
    [{ reason: reason({ tags: ['cancelMovement'] }) }, false],
    [{ reason: reason({ tags: ['cancelAdjustment'] }) }, false],
    [{ cancellationEventId: 'cancelled', destination: { name: 'Ward' } }, false],
    [{ stockEventLineItemId: null, destination: { name: 'Ward' } }, true],
  ] as const)('matches legacy for %j', (overrides, expected) => {
    expect(canReverseLine(line(overrides))).toBe(expected);
  });
  it('uses the line index only when its id is absent', () => {
    expect(reverseRowId(line(), 3)).toBe('line');
    expect(reverseRowId(line({ stockEventLineItemId: null }), 3)).toBe('3');
  });
});

describe('reversal reason type', () => {
  it.each([
    [{ destination: { name: 'Ward' }, source: { name: 'Warehouse' }, reason: null }, 'CREDIT'],
    [{ source: { name: 'Warehouse' }, reason: null }, 'DEBIT'],
    [{ reason: null }, undefined],
    [{ reason: reason({ reasonType: 'DEBIT' }) }, 'CREDIT'],
    [{ reason: reason({ reasonType: 'CREDIT' }) }, 'DEBIT'],
    [{ reason: reason({ reasonType: 'BALANCE' }) }, 'DEBIT'],
  ] as const)('matches legacy for %j', (overrides, expected) => {
    expect(reversalReasonType(line(overrides))).toBe(expected);
  });
});

describe('cancellation reasons', () => {
  const reasons = [
    reason({ id: 'issue', tags: ['cancelMovement'] }),
    reason({ id: 'receipt', tags: ['cancelMovement'], reasonType: 'DEBIT' }),
    reason({ id: 'debit', tags: ['cancelAdjustment'] }),
    reason({ id: 'credit', tags: ['cancelAdjustment'], reasonType: 'DEBIT' }),
    reason({ id: 'wrong-category', tags: ['cancelMovement'], reasonCategory: 'TRANSFER' }),
    reason({ id: 'no-tag' }),
  ];
  it.each([
    [{ destination: { name: 'Ward' } }, 'issue'],
    [{ source: { name: 'Warehouse' } }, 'receipt'],
    [{ reason: reason({ reasonType: 'DEBIT' }) }, 'debit'],
    [{}, 'credit'],
    [{ reason: reason({ reasonType: 'BALANCE' }) }, 'credit'],
  ] as const)('offers only the opposite reason for %j', (overrides, id) => {
    expect(cancellationReasons(line(overrides), reasons).map((item) => item.id)).toEqual([id]);
  });
  it('offers no cancellation reasons when the reversal type is undefined', () => {
    expect(cancellationReasons(line({ reason: null }), reasons)).toEqual([]);
  });
  it('keeps an empty list empty', () => {
    expect(cancellationReasons(line(), [])).toEqual([]);
  });
});

describe('reverse balances', () => {
  it('omits an undefined reversal and subtracts for other reason types', () => {
    const lines = [
      line({ stockEventLineItemId: 'undefined', reason: null, quantity: 100 }),
      line({ reason: reason({ reasonType: 'BALANCE' }) }),
    ];
    expect(newStockOnHand(lines, new Set(['undefined', 'line']), {})).toEqual({ line: 5 });
  });
  it('runs in line order across selected lines of the same product and lot in doses', () => {
    const lines = [
      line({ stockEventLineItemId: 'a', destination: { name: 'Ward' } }),
      line({ stockEventLineItemId: 'ignored', quantity: 100 }),
      line({ stockEventLineItemId: 'b', source: { name: 'Warehouse' }, quantity: 3 }),
      line({
        stockEventLineItemId: 'c',
        lot: { id: 'lot', lotCode: 'L', expirationDate: null },
        quantity: 4,
      }),
      line({ stockEventLineItemId: null, reason: reason({ reasonType: 'DEBIT' }), quantity: 2 }),
    ];
    expect(
      newStockOnHand(lines, new Set(['a', 'b', 'c', '4']), { 'product/': 20, 'product/lot': 2 }),
    ).toEqual({
      a: 25,
      b: 22,
      c: -2,
      '4': 24,
    });
  });
  it('falls back to each selected line balance and keeps a zero current balance', () => {
    const lines = [line(), line({ stockEventLineItemId: 'second', stockOnHand: 99 })];
    expect(newStockOnHand(lines, new Set(['line', 'second']), {})).toEqual({ line: 5, second: 89 });
    expect(newStockOnHand(lines, new Set(['line', 'second']), { 'product/': null })).toEqual({
      line: 5,
      second: 89,
    });
    expect(newStockOnHand(lines, new Set(['line']), { 'product/': 0 })).toEqual({ line: -5 });
    expect(newStockOnHand(lines, new Set(), {})).toEqual({});
  });
});

describe('reverse validation', () => {
  it('marks nothing when no row is selected', () => {
    expect(validateReverse([line()], { lines: {} }, {})).toEqual({
      valid: false,
      message: 'stock-event-reverse.none-selected',
      marks: {},
    });
  });
  it('collects both marks and reports a missing reason first across all rows', () => {
    const lines = [line({ stockEventLineItemId: 'a' }), line({ stockEventLineItemId: 'b' })];
    expect(
      validateReverse(
        lines,
        {
          lines: {
            a: { reasonId: 'reason', comments: '' },
            b: { reasonId: '', comments: '' },
          },
        },
        { 'product/': 0 },
      ),
    ).toEqual({
      valid: false,
      message: 'stock-event-reverse.reason-required',
      marks: {
        a: { stock: 'stock-event-reverse.negative-stock' },
        b: { reason: 'stock-events.required', stock: 'stock-event-reverse.negative-stock' },
      },
    });
  });
  it('reports negative stock after reasons and accepts a zero result', () => {
    const draft = { lines: { line: { reasonId: 'reason', comments: '' } } };
    expect(validateReverse([line()], draft, { 'product/': 0 }).message).toBe(
      'stock-event-reverse.negative-stock',
    );
    expect(validateReverse([line()], draft, { 'product/': 5 })).toEqual({ valid: true, marks: {} });
  });
  it('caps comments at 255 with a row mark', () => {
    expect(
      validateReverse(
        [line()],
        { lines: { line: { reasonId: 'reason', comments: 'x'.repeat(256) } } },
        {},
      ),
    ).toEqual({
      valid: false,
      message: 'stock-events.comments-too-long',
      marks: { line: { comments: 'stock-events.comments-too-long' } },
    });
    expect(
      validateReverse(
        [line()],
        { lines: { line: { reasonId: 'reason', comments: 'x'.repeat(255) } } },
        {},
      ).valid,
    ).toBe(true);
  });
  it('changes the reason, clears its mark and server error, and preserves the stock mark', () => {
    const row = {
      line: line(),
      reasonId: '',
      comments: 'Keep me',
      marks: {
        reason: 'stock-events.required' as const,
        stock: 'stock-event-reverse.negative-stock' as const,
      },
      serverError: { message: 'Server refused' },
    };
    expect(changeReverseReason(row, reason())).toEqual({
      line: row.line,
      reasonId: 'reason',
      comments: 'Keep me',
      marks: { stock: 'stock-event-reverse.negative-stock' },
    });
    expect(changeReverseReason(row, reason({ isFreeTextAllowed: false })).comments).toBe('');
    expect(row.comments).toBe('Keep me');
  });
});

describe('reverse payload and errors', () => {
  it('preserves a typed signature and comments and omits blank comments without refusing missing ids', () => {
    const rows = [
      { line: line(), reasonId: 'r1', comments: '' },
      { line: line({ stockEventLineItemId: null }), reasonId: 'r2', comments: '  ' },
      { line: line({ stockEventLineItemId: 'other' }), reasonId: 'r3', comments: ' As typed ' },
    ];
    expect(reversePayload(rows, '')).toEqual({
      signature: '',
      lineItems: [
        { stockEventLineItemId: 'line', reasonId: 'r1' },
        { stockEventLineItemId: null, reasonId: 'r2' },
        { stockEventLineItemId: 'other', reasonId: 'r3', reasonFreeText: ' As typed ' },
      ],
    });
    expect(reversePayload([], ' Typed ')).toEqual({ signature: ' Typed ', lineItems: [] });
  });
  it.each([
    [
      'stockmanagement.error.event.cancellation.reason.required',
      'stock-event-reverse.reason-required',
    ],
    [
      'stockmanagement.error.event.cancellation.reason.invalid',
      'stock-event-reverse.reason-invalid',
    ],
  ])('maps the raw placeholder message for %s', (messageKey, expected) => {
    expect(lineErrorMessage({ messageKey, message: 'Reason {0}' })).toEqual({ key: expected });
  });
  it('keeps other server messages and supplies the failed message when absent', () => {
    expect(lineErrorMessage({ messageKey: 'other', message: 'Server says no' })).toEqual({
      message: 'Server says no',
    });
    expect(lineErrorMessage({ message: 'stock-event-reverse.reason-required' })).toEqual({
      message: 'stock-event-reverse.reason-required',
    });
    expect(lineErrorMessage({})).toEqual({ key: 'stock-event-reverse.failed-description' });
  });
});
