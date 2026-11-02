import { QueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOrder } from '@/features/orders/api/api';
import { loadOrders } from '@/features/orders/lib/order-load';
import { creatingOrder } from '@/test-utils/order-fixtures';

vi.mock('@/features/orders/api/api', () => ({ fetchOrder: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
describe('batch order loading', () => {
  it('settles refused and missing tabs while preserving readable orders and refreshing only on enter', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const refused = new AxiosError('Denied', undefined, undefined, undefined, {
      status: 403,
    } as never);
    const missing = new AxiosError('Missing', undefined, undefined, undefined, {
      status: 404,
    } as never);
    vi.mocked(fetchOrder)
      .mockResolvedValueOnce(creatingOrder('a'))
      .mockRejectedValueOnce(refused)
      .mockRejectedValueOnce(missing);
    expect(await loadOrders(client, ['a', 'b', 'c'], true)).toMatchObject([
      { id: 'a', order: { id: 'a' } },
      { id: 'b', problem: 'no-read-access' },
      { id: 'c', problem: 'not-found' },
    ]);
    await loadOrders(client, ['a'], false);
    expect(fetchOrder).toHaveBeenCalledTimes(3);
    vi.mocked(fetchOrder).mockResolvedValueOnce({ ...creatingOrder('a'), status: 'ORDERED' });
    expect(await loadOrders(client, ['a'], true)).toMatchObject([
      { id: 'a', problem: 'not-creating' },
    ]);
    expect(fetchOrder).toHaveBeenCalledTimes(4);
  });
  it('lets an unexpected failure reach the route error and retry boundary', async () => {
    vi.mocked(fetchOrder).mockRejectedValue(new Error('Gateway Failure'));
    await expect(loadOrders(new QueryClient(), ['a'], true)).rejects.toThrow('Gateway Failure');
  });
});
