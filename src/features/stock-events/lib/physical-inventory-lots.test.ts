import { AxiosError } from 'axios';
import { expect, it, vi } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import {
  createInventoryLots,
  InventoryLotError,
} from '@/features/stock-events/lib/physical-inventory-lots';
import { addedInventoryLine } from '@/features/stock-events/lib/physical-inventory-products';

const lotLine = (code: string) =>
  addedInventoryLine(
    {
      orderable: { id: 'p', productCode: 'P', fullProductName: 'Product', description: null },
      lot: null,
      stockOnHand: null,
    },
    quantityValue('0'),
    { clientId: code, lotCode: code, expirationDate: null, tradeItemId: 't' },
  );
it('creates lots sequentially and persists each id before the next request', async () => {
  const order: string[] = [];
  const create = vi.fn(async (lot) => {
    order.push(`create:${lot.lotCode}`);
    return { ...lot, id: lot.lotCode };
  });
  const persist = vi.fn(async (lines) => {
    order.push(`persist:${lines.filter((line: { lot: unknown }) => line.lot).length}`);
  });
  const result = await createInventoryLots([lotLine('A'), lotLine('B')], create, persist);
  expect(order).toEqual(['create:A', 'persist:1', 'create:B', 'persist:2']);
  expect(result.map((line) => line.key)).toEqual(['p|A', 'p|B']);
  expect(result.every((line) => !line.newLot && line.justAdded)).toBe(true);
  await createInventoryLots(result, create, persist);
  expect(create).toHaveBeenCalledTimes(2);
});
it('keeps successful ids and stops the save with named lot errors', async () => {
  const create = vi
    .fn()
    .mockResolvedValueOnce({ id: 'id', lotCode: 'A', expirationDate: null })
    .mockRejectedValueOnce(
      new AxiosError('duplicate', undefined, undefined, undefined, {
        data: { messageKey: 'referenceData.error.lot.lotCode.mustBeUnique' },
      } as never),
    );
  const persist = vi.fn().mockResolvedValue(undefined);
  try {
    await createInventoryLots([lotLine('A'), lotLine('B'), lotLine('C')], create, persist);
    throw new Error('expected refusal');
  } catch (error) {
    expect(error).toBeInstanceOf(InventoryLotError);
    expect(error).toMatchObject({ codes: ['B'], reason: 'duplicate' });
  }
  expect(create).toHaveBeenCalledTimes(2);
  expect(persist).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ key: 'p|id', newLot: undefined })]),
  );
});
it('names a missing trade item error', async () => {
  const create = vi.fn().mockRejectedValue(
    new AxiosError('missing', undefined, undefined, undefined, {
      data: { messageKey: 'referenceData.error.lot.tradeItem.required' },
    } as never),
  );
  await expect(createInventoryLots([lotLine('B')], create, vi.fn())).rejects.toMatchObject({
    codes: ['B'],
    reason: 'trade-item',
  });
});
