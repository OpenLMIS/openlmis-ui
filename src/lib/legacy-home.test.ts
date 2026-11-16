import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { legacyHome } from '@/lib/legacy-home';

beforeEach(() => vi.stubEnv('VITE_LEGACY_UI_URL', ''));
afterEach(() => vi.unstubAllEnvs());

it.each([
  ['/v2/', '/'],
  ['/', '/'],
  ['/a/b/', '/a/'],
])('returns the parent of app base %s', (base, home) => {
  expect(legacyHome(base)).toBe(home);
});

it('uses the configured legacy server when the new UI occupies the preview root', () => {
  vi.stubEnv('VITE_LEGACY_UI_URL', 'https://legacy.example.org');
  expect(legacyHome('/')).toBe('https://legacy.example.org/');
});
