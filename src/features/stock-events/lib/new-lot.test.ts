import { describe, expect, it } from 'vitest';
import { editLotSchema, newLotSchema } from '@/features/stock-events/lib/new-lot';
import type { NewLot } from '@/features/stock-events/lib/types';

const today = '2026-10-12';
const lots = [{ id: 'lot-1', lotCode: 'LC2017A', expirationDate: '2019-01-30' }];
const newLot = (lotCode: string, expirationDate: string | null, tradeItemId = 'trade-1') => ({
  lotCode,
  expirationDate,
  tradeItemId,
});
const lines = [
  { key: 'a', lot: newLot('NEW-1', '2027-01-31') },
  { key: 'b', lot: newLot('OTHER', '2027-01-31', 'trade-2') },
  { key: 'c', lot: lots[0] },
];
const context = { tradeItemId: 'trade-1', lots, lines, today };
const issues = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.error?.issues.map(({ path, message }) => [path.join('.'), message]);
const add = (lotCode: string, expirationDate = '', patch: Partial<typeof context> = {}) =>
  issues(newLotSchema({ ...context, ...patch }).safeParse({ lotCode, expirationDate }));

describe('newLotSchema', () => {
  it.each([
    ['', 'stock-events.required'],
    ['   ', 'stock-events.required'],
    ['A'.repeat(21), 'stock-events.lot-code-too-long'],
    ['LOT#1', 'stock-events.lot-code-invalid'],
  ])('refuses the code %j', (code, message) => {
    expect(add(code)).toContainEqual(['lotCode', message]);
  });
  it('refuses an existing lot of the trade item in any letter case', () => {
    expect(add('lc2017a')).toEqual([['lotCode', 'stock-events.lot-code-exists']]);
  });
  it('refuses a draft new lot code with another expiry, across products of the trade item', () => {
    expect(add('new-1', '2027-06-30')).toEqual([['lotCode', 'stock-events.lot-code-exists']]);
    expect(add('NEW-1')).toEqual([['lotCode', 'stock-events.lot-code-exists']]);
    expect(add('NEW-1', '2027-01-31')).toBeUndefined();
    expect(add('OTHER', '2027-06-30')).toBeUndefined();
  });
  it('allows an empty or current expiry and refuses a past one', () => {
    expect(add('NEW-2')).toBeUndefined();
    expect(add('NEW-2', today)).toBeUndefined();
    expect(add('NEW-2', '2026-10-11')).toEqual([
      ['expirationDate', 'stock-events.lot-expiry-past'],
    ]);
  });
});

describe('editLotSchema', () => {
  const edit = (lot: NewLot, lotCode: string, expirationDate = '') =>
    issues(
      editLotSchema({ lot, lineKey: 'x', lots, lines, today }).safeParse({
        lotCode,
        expirationDate,
      }),
    );
  const own = newLot('MINE', '2027-06-30');
  it('reports a changed code used by a draft line with another expiry on the expiry field', () => {
    expect(edit(own, 'NEW-1', '2027-06-30')).toEqual([
      ['expirationDate', 'stock-events.lot-expiry-conflict'],
    ]);
    expect(edit(own, 'NEW-1', '2027-01-31')).toBeUndefined();
    expect(edit(newLot('MINE', '2027-06-30', 'trade-2'), 'NEW-1', '2027-06-30')).toBeUndefined();
  });
  it('checks for conflicts and existing lots only when the code changed', () => {
    expect(edit(newLot('NEW-1', '2027-01-31'), 'NEW-1', '2027-06-30')).toBeUndefined();
    expect(edit(newLot('LC2017A', null), 'LC2017A')).toBeUndefined();
    expect(edit(own, 'lc2017a')).toEqual([['lotCode', 'stock-events.lot-code-exists']]);
  });
  it('applies the code and expiry rules of a new lot', () => {
    expect(edit(own, '')).toEqual([['lotCode', 'stock-events.required']]);
    expect(edit(own, 'MINE', '2026-01-01')).toEqual([
      ['expirationDate', 'stock-events.lot-expiry-past'],
    ]);
  });
});
