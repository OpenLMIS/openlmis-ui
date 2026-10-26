import { afterEach, expect, it, vi } from 'vitest';
import { randomId } from '@/lib/random-id';

afterEach(() => vi.unstubAllGlobals());

it('makes version 4 UUIDs where plain HTTP hides crypto.randomUUID', () => {
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });

  const first = randomId();

  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(randomId()).not.toBe(first);
});
