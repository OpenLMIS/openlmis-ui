import { beforeEach, expect, it, vi } from 'vitest';
import { fetchFacilityCce } from '@/features/cce-inventory/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));
let currentScope = 0;
vi.mock('@/lib/session-scope', () => ({
  getSessionScope: () => currentScope,
  assertSessionScope: (scope: number) => {
    if (scope !== currentScope) throw new Error('session ended');
  },
}));
beforeEach(() => vi.resetAllMocks());
it('reads every facility inventory page, filters leaked facilities and requests active alerts with size', async () => {
  vi.mocked(client.get)
    .mockResolvedValueOnce({
      data: {
        content: [
          { id: 'a', facility: { id: 'f' } },
          { id: 'leak', facility: { id: 'other' } },
        ],
        totalPages: 2,
      },
    })
    .mockResolvedValueOnce({
      data: { content: [{ id: 'b', facility: { id: 'f' } }], totalPages: 2 },
    })
    .mockResolvedValueOnce({
      data: {
        content: [
          { device_id: 'a', end_ts: null, dismissed: false },
          { device_id: 'b', end_ts: 'ended', dismissed: false },
        ],
        totalPages: 1,
      },
    });
  const result = await fetchFacilityCce('f');
  expect(result.items.map((item) => item.id)).toEqual(['a', 'b']);
  expect(result.alerts).toHaveLength(1);
  expect(vi.mocked(client.get).mock.calls[1][1]?.params).toMatchObject({
    facilityId: 'f',
    page: 1,
  });
  expect(vi.mocked(client.get).mock.calls[2][1]?.params).toMatchObject({
    deviceId: ['a', 'b'],
    size: 100,
  });
});
it('stops between inventory pages when identity changes', async () => {
  vi.mocked(client.get).mockImplementation(async () => {
    currentScope += 1;
    return { data: { content: [], totalPages: 2 } };
  });
  await expect(fetchFacilityCce('f')).rejects.toThrow('session ended');
  expect(client.get).toHaveBeenCalledTimes(1);
});
