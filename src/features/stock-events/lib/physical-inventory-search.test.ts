import { describe, expect, it } from 'vitest';
import { inventorySearchSchema } from '@/features/stock-events/lib/physical-inventory-search';

describe('inventory URL search', () => {
  it('leaves defaults out and bounds keywords at the legacy 50 characters', () => {
    expect(
      inventorySearchSchema.parse({ page: 1, size: 20, keyword: ' ', includeInactive: false }),
    ).toEqual({ page: undefined, size: undefined, keyword: undefined, includeInactive: undefined });
    expect(inventorySearchSchema.parse({ keyword: 'a'.repeat(51) }).keyword).toHaveLength(50);
  });
  it('keeps valid filters and drops invalid ones', () => {
    expect(
      inventorySearchSchema.parse({ page: 2, size: 50, keyword: 'lot', includeInactive: true }),
    ).toEqual({ page: 2, size: 50, keyword: 'lot', includeInactive: true });
    expect(
      inventorySearchSchema.parse({ page: -1, size: 101, includeInactive: 'false' }),
    ).toMatchObject({ page: undefined, size: undefined, includeInactive: undefined });
  });
});
