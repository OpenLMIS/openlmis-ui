import { beforeEach, expect, it, vi } from 'vitest';
import { findShipmentDraft, saveShipmentDraft } from '@/features/orders/api/api';
import {
  mergeShipmentFills,
  ShipmentDraftExpiredError,
  saveExistingShipmentDraft,
} from '@/features/orders/lib/shipment-actions';
import type { ShipmentLine } from '@/features/orders/lib/shipment-lines';
import type { ShipmentRecord } from '@/features/orders/lib/shipment-types';

vi.mock('@/features/orders/api/api', () => ({
  findShipmentDraft: vi.fn(),
  saveShipmentDraft: vi.fn(),
}));
let scope = 0;
vi.mock('@/lib/session-scope', () => ({
  getSessionScope: () => scope,
  assertSessionScope: (expected: number) => {
    if (expected !== scope) throw new Error('session ended');
  },
}));
const draft: ShipmentRecord = { id: 'draft', order: { id: 'order' }, lineItems: [] };
const line: ShipmentLine = {
  key: 'product-lot',
  orderedProductId: 'product',
  product: { id: 'product', meta: { versionNumber: 2 } },
  lot: { id: 'lot' },
  stockOnHand: 20,
  fill: 3,
};
beforeEach(() => {
  vi.resetAllMocks();
  scope += 1;
  vi.mocked(findShipmentDraft).mockResolvedValue(draft);
  vi.mocked(saveShipmentDraft).mockResolvedValue(draft);
});
it.each([null, { ...draft, id: 'replacement' }])(
  'never saves an absent or replaced draft',
  async (current) => {
    vi.mocked(findShipmentDraft).mockResolvedValue(current);
    await expect(saveExistingShipmentDraft(draft, [line])).rejects.toBeInstanceOf(
      ShipmentDraftExpiredError,
    );
    expect(saveShipmentDraft).not.toHaveBeenCalled();
  },
);
it('detects a replacement created in the gap between the existence read and save', async () => {
  vi.mocked(saveShipmentDraft).mockResolvedValue({ ...draft, id: 'stray' });
  await expect(saveExistingShipmentDraft(draft, [line])).rejects.toBeInstanceOf(
    ShipmentDraftExpiredError,
  );
});
it('stops before writing if the session changes during the existence check', async () => {
  vi.mocked(findShipmentDraft).mockImplementation(async () => {
    scope += 1;
    return draft;
  });
  await expect(saveExistingShipmentDraft(draft, [line])).rejects.toThrow('session ended');
  expect(saveShipmentDraft).not.toHaveBeenCalled();
});
it('preserves typing during save while adopting persisted ids and unchanged server values', () => {
  const second = { ...line, key: 'product-none', lot: null, fill: 0 };
  const response: ShipmentRecord = {
    ...draft,
    lineItems: [
      {
        id: 'saved-lot',
        orderable: { id: 'product', versionNumber: 2 },
        lot: { id: 'lot' },
        quantityShipped: 3,
      },
      {
        id: 'saved-none',
        orderable: { id: 'product', versionNumber: 2 },
        lot: null,
        quantityShipped: 1,
      },
    ],
  };
  const merged = mergeShipmentFills([{ ...line, fill: 7 }, second], [line, second], response);
  expect(merged.map(({ id, fill }) => ({ id, fill }))).toEqual([
    { id: 'saved-lot', fill: 7 },
    { id: 'saved-none', fill: 1 },
  ]);
});
