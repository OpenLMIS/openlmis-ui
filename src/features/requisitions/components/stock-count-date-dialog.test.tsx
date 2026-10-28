import { expect, it } from 'vitest';
import { stockCountDateSchema } from './stock-count-date-dialog';

it('requires a real stock count date no later than today', () => {
  const schema = stockCountDateSchema('2026-10-28');
  for (const date of ['', '2026-10-29', '2026-02-30']) {
    expect(schema.safeParse({ date }).success).toBe(false);
  }
  expect(schema.safeParse({ date: '2026-10-28' }).success).toBe(true);
  expect(schema.safeParse({ date: '2026-10-01' }).success).toBe(true);
});
