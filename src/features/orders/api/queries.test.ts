import { QueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { beforeEach, expect, it, vi } from 'vitest';
import { fetchOrderStockOnHand } from '@/features/orders/api/api';
import { orderStockOnHandOptions } from '@/features/orders/api/queries';

vi.mock('@/features/orders/api/api', () => ({ fetchOrderStockOnHand: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const filter = { programId: 'p', facilityId: 'f' };
it('batches only uncached products and reuses their balances across line sets', async () => {
  const client = new QueryClient();
  vi.mocked(fetchOrderStockOnHand).mockImplementation(async ({ orderableIds }) =>
    orderableIds.map((id) => ({ orderable: { id }, stockOnHand: 10 })),
  );
  await client.fetchQuery(orderStockOnHandOptions({ ...filter, orderableIds: ['a', 'b'] }));
  await client.fetchQuery(
    orderStockOnHandOptions({ ...filter, orderableIds: ['a', 'b', 'c', 'd'] }),
  );
  expect(fetchOrderStockOnHand).toHaveBeenLastCalledWith({ ...filter, orderableIds: ['c', 'd'] });
  await client.fetchQuery(orderStockOnHandOptions({ ...filter, orderableIds: ['b', 'd'] }));
  expect(fetchOrderStockOnHand).toHaveBeenCalledTimes(2);
});
it('leaves refused balances blank, but surfaces other failures for retry', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(fetchOrderStockOnHand).mockRejectedValueOnce(
    new AxiosError('Refused', undefined, undefined, undefined, { status: 403 } as never),
  );
  await expect(
    client.fetchQuery(orderStockOnHandOptions({ ...filter, orderableIds: ['a'] })),
  ).resolves.toEqual([{ orderable: { id: 'a' }, stockOnHand: null }]);
  vi.mocked(fetchOrderStockOnHand).mockRejectedValueOnce(new Error('Unavailable'));
  await expect(
    client.fetchQuery(orderStockOnHandOptions({ ...filter, orderableIds: ['b'] })),
  ).rejects.toThrow('Unavailable');
});

it('shares in-flight product reads when another line is added before the balance arrives', async () => {
  const client = new QueryClient();
  const first = Promise.withResolvers<Awaited<ReturnType<typeof fetchOrderStockOnHand>>>();
  vi.mocked(fetchOrderStockOnHand)
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce([{ orderable: { id: 'b' }, stockOnHand: 20 }]);
  const initial = client.fetchQuery(orderStockOnHandOptions({ ...filter, orderableIds: ['a'] }));
  const expanded = client.fetchQuery(
    orderStockOnHandOptions({ ...filter, orderableIds: ['a', 'b'] }),
  );
  first.resolve([{ orderable: { id: 'a' }, stockOnHand: 10 }]);
  await Promise.all([initial, expanded]);
  expect(fetchOrderStockOnHand).toHaveBeenLastCalledWith({ ...filter, orderableIds: ['b'] });
});
