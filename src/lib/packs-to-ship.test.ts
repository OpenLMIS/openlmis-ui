import { expect, it } from 'vitest';
import { packsToShip } from '@/lib/quantity';

it.each([
  [20, 10, -1, false, 2],
  [15, 10, 5, false, 1],
  [16, 10, 5, false, 2],
  [5, 10, 5, false, 1],
  [5, 10, 5, true, 0],
  [0, 10, 5, false, 0],
  [-1, 10, 5, false, 0],
  [10, 0, 5, false, 0],
])('rounds packs (%s/%s threshold %s, zero %s)', (q, size, threshold, zero, expected) => {
  expect(packsToShip(q as number, size as number, threshold as number, zero as boolean)).toBe(
    expected,
  );
});
