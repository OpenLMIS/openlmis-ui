import { expect, it } from 'vitest';
import { legacyHome } from '@/lib/legacy-home';

it.each([
  ['/v2/', '/'],
  ['/', '/'],
  ['/a/b/', '/a/'],
])('returns the parent of app base %s', (base, home) => {
  expect(legacyHome(base)).toBe(home);
});
