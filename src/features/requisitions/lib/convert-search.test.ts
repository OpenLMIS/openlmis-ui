import { expect, it } from 'vitest';
import {
  convertSelectionError,
  releaseBody,
  seedDepots,
  toConvertQuery,
} from '@/features/requisitions/lib/convert-search';

it('preselects only a sole non-null depot and reconciles fresh offers without losing other pages', () => {
  const depot = (id: string) => ({ id, name: id });
  const rows = [
    { requisition: { id: 'one' }, supplyingDepots: [depot('a')] },
    { requisition: { id: 'many' }, supplyingDepots: [depot('a'), depot('b')] },
    { requisition: { id: 'none' }, supplyingDepots: [null] },
  ];
  expect(seedDepots({}, rows)).toEqual({ one: 'a', many: '', none: '' });
  expect(seedDepots({ one: 'old', many: 'b', elsewhere: 'c' }, rows)).toEqual({
    one: 'a',
    many: 'b',
    none: '',
    elsewhere: 'c',
  });
});
it('validates every ticked row and builds both actions from current depots across pages', () => {
  const picked = new Map([
    ['first', { label: 'First' }],
    ['second', { label: 'Second' }],
  ]);
  expect(convertSelectionError(new Map(), {})).toBe('none');
  expect(convertSelectionError(picked, { first: 'a' })).toBe('depot');
  expect(convertSelectionError(picked, { first: 'changed', second: 'b' })).toBeUndefined();
  for (const createOrder of [true, false]) {
    expect(releaseBody(createOrder, picked, { first: 'changed', second: 'b' })).toEqual({
      createOrder,
      requisitionsToRelease: [
        { requisitionId: 'first', supplyingDepotId: 'changed' },
        { requisitionId: 'second', supplyingDepotId: 'b' },
      ],
    });
  }
});
it('always sends size and never sends sort', () => {
  expect(toConvertQuery({})).toEqual({ page: 0, size: 10 });
  expect(toConvertQuery({ page: 3, size: 2, programId: 'p', facilityId: 'f' })).toEqual({
    page: 2,
    size: 2,
    programId: 'p',
    facilityId: 'f',
  });
});

it('uses the legacy ten-row request unless a page size is chosen', () => {
  expect(toConvertQuery({})).toEqual({ page: 0, size: 10 });
  expect(toConvertQuery({ size: 50, page: 2 })).toEqual({ page: 1, size: 50 });
});
