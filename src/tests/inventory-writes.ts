import { expect, vi } from 'vitest';
import { writeInventoryLocal } from '@/features/stock-events/lib/physical-inventory-local';

export function inventoryWrites() {
  return vi
    .mocked(writeInventoryLocal)
    .mock.calls.map(([copy, , , reference, allowOrphan, options]) => ({
      copy,
      reference,
      allowOrphan,
      options,
    }));
}

export function inventoryWrite(copy: unknown, options = { snapshotOnly: false }) {
  return [
    copy,
    expect.any(Number),
    expect.anything(),
    expect.anything(),
    undefined,
    expect.objectContaining(options),
  ];
}
