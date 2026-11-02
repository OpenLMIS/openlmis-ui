import { waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { deleteOrders, fetchOrder, sendOrder } from '@/features/orders/api/api';
import { executeOrderWrite } from '@/features/orders/lib/order-actions';
import { draftLines } from '@/features/orders/lib/order-draft';
import { SessionEndedError } from '@/lib/session-scope';
import { creatingOrder } from '@/test-utils/order-fixtures';

vi.mock('@/features/orders/api/api', () => ({
  deleteOrders: vi.fn(),
  fetchOrder: vi.fn(),
  saveOrder: vi.fn(),
  sendOrder: vi.fn(),
}));
const httpError = (status: number) =>
  new AxiosError('Refused', undefined, undefined, undefined, {
    status,
    data: { message: 'Server Reason' },
    statusText: '',
    headers: {},
    config: {} as never,
  });
beforeEach(() => {
  vi.resetAllMocks();
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'user', username: 'user', accessToken: 'token' });
});
describe('order write recovery', () => {
  it('keeps a failed draft with its reason and treats a changed status as blocked, never resending', async () => {
    vi.mocked(sendOrder)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(httpError(400))
      .mockRejectedValueOnce(httpError(400));
    vi.mocked(fetchOrder)
      .mockResolvedValueOnce(creatingOrder('b'))
      .mockResolvedValueOnce({ ...creatingOrder('c'), status: 'ORDERED' });
    const result = await executeOrderWrite({
      kind: 'send',
      snapshots: ['a', 'b', 'c'].map((id) => ({
        order: creatingOrder(id),
        lines: draftLines(creatingOrder(id)),
      })),
    });
    expect(result.find((item) => item.id === 'a')?.success).toBe(true);
    expect(result.find((item) => item.id === 'b')).toMatchObject({
      success: false,
      error: expect.any(AxiosError),
    });
    expect(result.find((item) => item.id === 'c')).toMatchObject({
      success: false,
      problem: 'not-creating',
    });
    expect(sendOrder).toHaveBeenCalledTimes(3);
  });
  it.each([
    [404, 'not-found'],
    [403, 'unresolved'],
    [500, 'unresolved'],
  ] as const)('blocks an uncertain send after reread %s', async (status, problem) => {
    vi.mocked(sendOrder).mockRejectedValue(httpError(400));
    vi.mocked(fetchOrder).mockRejectedValue(httpError(status));
    const order = creatingOrder();
    expect(
      await executeOrderWrite({ kind: 'send', snapshots: [{ order, lines: draftLines(order) }] }),
    ).toMatchObject([{ success: false, problem }]);
  });
  it('stops recovery when identity changes during a failed reread', async () => {
    const read = Promise.withResolvers<OrderReturn>();
    vi.mocked(sendOrder).mockRejectedValue(httpError(400));
    vi.mocked(fetchOrder).mockImplementation(() => read.promise);
    const order = creatingOrder();
    const running = executeOrderWrite({
      kind: 'send',
      snapshots: [{ order, lines: draftLines(order) }],
    });
    await waitFor(() => expect(fetchOrder).toHaveBeenCalledOnce());
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'other', username: 'other', accessToken: 'other' });
    read.reject(httpError(403));
    await expect(running).rejects.toBeInstanceOf(SessionEndedError);
    expect(sendOrder).toHaveBeenCalledOnce();
  });
  it('deletes all ids atomically and rereads a delete 404 without assuming any were removed', async () => {
    vi.mocked(deleteOrders).mockRejectedValue(httpError(404));
    vi.mocked(fetchOrder)
      .mockResolvedValueOnce(creatingOrder('a'))
      .mockRejectedValueOnce(httpError(404));
    expect(await executeOrderWrite({ kind: 'delete', ids: ['a', 'b'] })).toMatchObject([
      { id: 'a', success: false },
      { id: 'b', success: false, problem: 'not-found' },
    ]);
    expect(deleteOrders).toHaveBeenCalledWith(['a', 'b']);
  });
});
type OrderReturn = Awaited<ReturnType<typeof fetchOrder>>;
