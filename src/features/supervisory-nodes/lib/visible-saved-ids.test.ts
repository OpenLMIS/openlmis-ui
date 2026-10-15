import { expect, it } from 'vitest';
import { visibleSavedIds } from '@/features/supervisory-nodes/lib/visible-saved-ids';

it('keys only visible saved rows in sorted order, including after removals clamp the page', () => {
  const saved = [{ id: 'z' }, { id: 'b' }, { id: 'a' }, { id: 'c' }];
  const ids = new Set(saved.map(({ id }) => id));
  expect(visibleSavedIds(saved, 1, 2, ids)).toEqual(['b', 'z']);
  expect(visibleSavedIds(saved, 2, 2, ids)).toEqual(['a', 'c']);
  expect(visibleSavedIds([{ id: 'b' }, { id: 'new', name: 'Added' }], 2, 2, ids)).toEqual(['b']);
  expect(visibleSavedIds([], 1, 10, ids)).toEqual([]);
});
