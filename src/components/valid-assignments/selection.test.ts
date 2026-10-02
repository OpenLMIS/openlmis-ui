import { describe, expect, it } from 'vitest';
import {
  applySelection,
  toRowSelection,
  withoutIds,
} from '@/components/valid-assignments/selection';

const rows = [
  { id: 'a', name: 'Balaka' },
  { id: 'b', name: 'CHW' },
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
