import { expect, it, vi } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import { addedInventoryLine } from '@/features/stock-events/lib/physical-inventory-products';
import {
  countInventoryScan,
  resolveInventoryScan,
} from '@/features/stock-events/lib/physical-inventory-scan';

const product = {
  id: 'p',
  productCode: 'P',
  fullProductName: 'Product',
  description: null,
  netContent: 10,
  identifiers: { tradeItem: 't' },
};
const eligible = [
  { orderable: product, lot: null, stockOnHand: null },
  {
    orderable: product,
    lot: { id: 'l', lotCode: 'Batch', expirationDate: '2027-01-01' },
    stockOnHand: null,
  },
];
const scan = { gtin: 'g', lotCode: 'batch', expiry: '2028-01-01' };
it('finds stockless products in the full eligible list and counts one pack in doses', async () => {
  const result = await resolveInventoryScan({
    scan: { gtin: 'g' },
    tradeItemId: 't',
    eligible,
    lines: [],
    canManageLots: false,
    acceptedExpiries: new Set(),
    confirm: vi.fn(),
  });
  expect(result.type).toBe('line');
  if (result.type !== 'line') return;
  expect(countInventoryScan(result.line).quantity.doses).toBe('10');
  expect(
    countInventoryScan({ ...result.line, orderable: { ...product, netContent: 0 } }).quantity.doses,
  ).toBe('1');
});
it('asks before adding an unknown lot and refuses it without LOTS_MANAGE', async () => {
  const confirm = vi.fn().mockResolvedValue(true);
  const options = {
    scan: { ...scan, lotCode: 'New' },
    tradeItemId: 't',
    eligible,
    lines: [],
    acceptedExpiries: new Set<string>(),
    confirm,
  };
  expect(await resolveInventoryScan({ ...options, canManageLots: false })).toMatchObject({
    type: 'refuse',
    message: { key: 'physical-inventory.scan-no-lot-right' },
  });
  expect(confirm).not.toHaveBeenCalled();
  const result = await resolveInventoryScan({ ...options, canManageLots: true });
  expect(confirm).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'new-lot', lotCode: 'New' }),
  );
  expect(result).toMatchObject({
    type: 'line',
    line: { newLot: { lotCode: 'New', tradeItemId: 't' } },
  });
});
it('asks about an expiry mismatch once per lot, keeps the recorded expiry, and reuses pending lots', async () => {
  const confirm = vi.fn().mockResolvedValue(true);
  const options = {
    scan,
    tradeItemId: 't',
    eligible,
    lines: [],
    canManageLots: true,
    acceptedExpiries: new Set<string>(),
    confirm,
  };
  const first = await resolveInventoryScan(options);
  await resolveInventoryScan({ ...options, scan: { ...scan, expiry: '2029-01-01' } });
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(first).toMatchObject({ type: 'line', line: { lot: { expirationDate: '2027-01-01' } } });
  const pending = addedInventoryLine(eligible[0], quantityValue('10'), {
    clientId: 'new',
    lotCode: 'New',
    expirationDate: '2027-01-01',
    tradeItemId: 't',
  });
  confirm.mockClear();
  const result = await resolveInventoryScan({
    ...options,
    scan: { gtin: 'g', lotCode: 'new' },
    lines: [pending],
  });
  expect(result).toMatchObject({ type: 'line', line: { key: pending.key } });
  expect(confirm).not.toHaveBeenCalled();
});
it('reactivates a hidden inactive line and preserves its reasons', () => {
  const line = {
    ...addedInventoryLine(eligible[1], quantityValue('7')),
    active: false,
    stockOnHand: 0,
    stockAdjustments: [{ reason: { id: 'r', reasonType: 'CREDIT' }, quantity: 7 }],
  };
  expect(countInventoryScan(line)).toMatchObject({
    active: true,
    isAdded: true,
    quantity: { doses: '17' },
    stockAdjustments: line.stockAdjustments,
  });
});
it('does not apply a refused confirmation or an aborted scan', async () => {
  const options = {
    scan,
    tradeItemId: 't',
    eligible,
    lines: [],
    canManageLots: true,
    acceptedExpiries: new Set<string>(),
    confirm: vi.fn().mockResolvedValue(false),
  };
  expect(await resolveInventoryScan(options)).toMatchObject({ type: 'refuse' });
  const controller = new AbortController();
  controller.abort();
  expect(await resolveInventoryScan({ ...options, signal: controller.signal })).toMatchObject({
    type: 'cancelled',
  });
  expect(options.confirm).toHaveBeenCalledTimes(1);
});
