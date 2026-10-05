import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  applySelection,
  toRowSelection,
  useFilterSelection,
  withoutIds,
} from '@/components/valid-assignments/selection';

const rows = [
  { id: 'a', label: 'Balaka' },
  { id: 'b', label: 'CHW' },
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

describe('useFilterSelection', () => {
  const balaka = new Map([['a', 'Balaka']]);

  it('keeps what was picked under the same filter', () => {
    const { result } = renderHook(() => useFilterSelection('f1|p1'));

    act(() => result.current[1](balaka, 'f1|p1'));
    expect(result.current[0]).toEqual(balaka);
  });

  it('clears the selection when the filter changes, and does not bring it back on return', () => {
    const { result, rerender } = renderHook(({ filter }) => useFilterSelection(filter), {
      initialProps: { filter: '|' },
    });
    act(() => result.current[1](balaka, '|'));

    rerender({ filter: '|p1' });
    expect(result.current[0].size).toBe(0);
    rerender({ filter: '|' });
    expect(result.current[0].size).toBe(0);
  });

  it('ignores a pick on rows still showing from the previous filter', () => {
    const { result } = renderHook(() => useFilterSelection('f1|p2'));

    act(() => result.current[1](balaka, 'f1|p1'));
    expect(result.current[0].size).toBe(0);
  });
});
