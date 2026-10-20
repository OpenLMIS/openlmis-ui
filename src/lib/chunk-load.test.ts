import { afterEach, expect, it, vi } from 'vitest';
import { reloadOnce } from '@/lib/chunk-load';

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

it('reloads once for a missing app part, and again only after the guard lapses', () => {
  vi.useFakeTimers();
  const reload = vi.fn();

  expect(reloadOnce(reload)).toBe(true);
  expect(reloadOnce(reload)).toBe(false);
  vi.advanceTimersByTime(30_000);
  expect(reloadOnce(reload)).toBe(true);

  expect(reload).toHaveBeenCalledTimes(2);
});
