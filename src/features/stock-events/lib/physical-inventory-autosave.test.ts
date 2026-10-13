import { expect, it, vi } from 'vitest';
import { createInventoryWriter } from '@/features/stock-events/lib/physical-inventory-autosave';

it('serializes writes and replaces waiting snapshots with the latest', async () => {
  const finish = Promise.withResolvers<void>();
  const write = vi
    .fn()
    .mockImplementationOnce(() => finish.promise)
    .mockResolvedValue(undefined);
  const status = vi.fn();
  const writer = createInventoryWriter(write, status);
  writer.enqueue(1);
  writer.enqueue(2);
  writer.enqueue(3);
  expect(write.mock.calls).toEqual([[1]]);
  expect(status).toHaveBeenLastCalledWith('saving');
  finish.resolve();
  await writer.flush();
  expect(write.mock.calls).toEqual([[1], [3]]);
  expect(status).toHaveBeenLastCalledWith('saved');
});
it('reports failure and retries the next change', async () => {
  const write = vi.fn().mockRejectedValueOnce(new Error('Full')).mockResolvedValue(undefined);
  const status = vi.fn();
  const writer = createInventoryWriter(write, status);
  writer.enqueue(1);
  await writer.flush();
  expect(status).toHaveBeenLastCalledWith('failed');
  writer.enqueue(2);
  await writer.flush();
  expect(status).toHaveBeenLastCalledWith('saved');
});
