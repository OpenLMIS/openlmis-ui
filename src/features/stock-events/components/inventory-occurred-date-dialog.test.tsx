import { expect, it } from 'vitest';
import { inventoryOccurredSchema } from '@/features/stock-events/components/inventory-occurred-date-dialog';

it('requires a real date no later than today and bounds the optional signature', () => {
  const schema = inventoryOccurredSchema('2026-10-09');
  expect(schema.safeParse({ occurredDate: '2026-10-09', signature: '' }).success).toBe(true);
  expect(
    schema.safeParse({ occurredDate: '31/02/2026', signature: '' }).error?.issues[0]?.message,
  ).toBe('form.date-invalid');
  for (const occurredDate of ['', '2026-10-10', '2026-02-30'])
    expect(schema.safeParse({ occurredDate, signature: '' }).success).toBe(false);
  expect(schema.safeParse({ occurredDate: '2026-10-08', signature: 'a'.repeat(256) }).success).toBe(
    false,
  );
});
