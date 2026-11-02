import { beforeEach, expect, it, vi } from 'vitest';
import { fetchOrderStockOnHand } from '@/features/orders/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
it('uses each summary balance across every page and defaults absent products to zero', async () => {
  vi.mocked(client.get)
    .mockResolvedValueOnce({
      data: {
        content: [
          {
            orderable: { id: 'a' },
            stockOnHand: -13,
            canFulfillForMe: [{ orderable: { id: 'a' }, stockOnHand: 999 }],
          },
        ],
        totalPages: 2,
      },
    })
    .mockResolvedValueOnce({
      data: {
        content: [{ orderable: { id: 'b' }, stockOnHand: 20, canFulfillForMe: [] }],
        totalPages: 2,
      },
    });
  await expect(
    fetchOrderStockOnHand({ programId: 'p', facilityId: 'f', orderableIds: ['a', 'b', 'c'] }),
  ).resolves.toEqual([
    { orderable: { id: 'a' }, stockOnHand: -13 },
    { orderable: { id: 'b' }, stockOnHand: 20 },
    { orderable: { id: 'c' }, stockOnHand: 0 },
  ]);
  expect(client.get).toHaveBeenCalledTimes(2);
  expect(vi.mocked(client.get).mock.calls[1][1]).toMatchObject({ params: { page: 1 } });
});
it('does not turn a refused stock request into zero balances', async () => {
  const error = new Error('Refused');
  vi.mocked(client.get).mockRejectedValue(error);
  await expect(
    fetchOrderStockOnHand({ programId: 'p', facilityId: 'f', orderableIds: ['a'] }),
  ).rejects.toBe(error);
});
