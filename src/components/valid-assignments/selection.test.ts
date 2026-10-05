import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  applySelection,
  NOTHING_PICKED,
  toRowSelection,
  useFilterScoped,
  withoutIds,
} from '@/components/valid-assignments/selection';

const rows = [
  { id: 'a', rowName: 'Balaka' },
  { id: 'b', rowName: 'CHW' },
];

describe('applySelection', () => {
  it('names a newly picked row from the rows on screen', () => {
    expect(applySelection(new Map(), { a: true }, rows)).toEqual(new Map([['a', 'Balaka']]));
  });

  it('keeps a row picked on another page, which is not on screen', () => {
    const picked = new Map([['z', 'Lurio']]);

    expect(applySelection(picked, { z: true, b: true }, rows)).toEqual(
      new Map([
        ['z', 'Lurio'],
        ['b', 'CHW'],
      ]),
    );
  });

  it('drops a row that was unpicked', () => {
    const picked = new Map([
      ['a', 'Balaka'],
      ['b', 'CHW'],
    ]);

    expect(applySelection(picked, { a: true }, rows)).toEqual(new Map([['a', 'Balaka']]));
  });
});

describe('applySelection names', () => {
  it('renames a picked row still on screen with its current name', () => {
    const picked = new Map([['a', 'Balaka']]);
    const named = [{ id: 'a', rowName: 'Balaka for Health Center in EPI' }];

    expect(applySelection(picked, { a: true }, named)).toEqual(
      new Map([['a', 'Balaka for Health Center in EPI']]),
    );
  });
});

describe('toRowSelection', () => {
  it('marks every picked id selected, for the table', () => {
    expect(toRowSelection(new Map([['a', 'Balaka']]))).toEqual({ a: true });
  });
});

describe('withoutIds', () => {
  it('leaves out the given ids, such as the ones just deleted', () => {
    const picked = new Map([
      ['a', 'Balaka'],
      ['b', 'CHW'],
    ]);

    expect(withoutIds(picked, ['a'])).toEqual(new Map([['b', 'CHW']]));
  });
});

describe('useFilterScoped', () => {
  const balaka = new Map([['a', 'Balaka']]);

  it('keeps what was picked under the same filter', () => {
    const { result } = renderHook(() => useFilterScoped('f1|p1', NOTHING_PICKED));

    act(() => result.current[1](balaka, 'f1|p1'));
    expect(result.current[0]).toEqual(balaka);
  });

  it('clears the selection when the filter changes, and does not bring it back on return', () => {
    const { result, rerender } = renderHook(
      ({ filter }) => useFilterScoped(filter, NOTHING_PICKED),
      {
        initialProps: { filter: '|' },
      },
    );
    act(() => result.current[1](balaka, '|'));

    rerender({ filter: '|p1' });
    expect(result.current[0].size).toBe(0);
    rerender({ filter: '|' });
    expect(result.current[0].size).toBe(0);
  });

  it('ignores a pick on rows still showing from the previous filter', () => {
    const { result } = renderHook(() => useFilterScoped('f1|p2', NOTHING_PICKED));

    act(() => result.current[1](balaka, 'f1|p1'));
    expect(result.current[0].size).toBe(0);
  });
});
