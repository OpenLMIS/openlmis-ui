import { afterEach, expect, it, vi } from 'vitest';
import { fetchConvertList, releaseRequisitions } from '@/features/requisitions/api/api';
import { client } from '@/integrations/axios';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('reads the wrapped legacy page and removes repeated requisition ids without reordering', async () => {
  const row = (id: string) => ({ requisition: { id }, supplyingDepots: [null] });
  vi.spyOn(client, 'get').mockResolvedValue({
    data: { content: [row('b'), row('a'), row('b')], totalElements: 3 },
  });
  const page = await fetchConvertList({ page: 0, size: 20 });
  expect(client.get).toHaveBeenCalledWith('/requisitions/requisitionsForConvert', {
    params: { page: 0, size: 20 },
  });
  expect(page.content.map(({ requisition }) => requisition.id)).toEqual(['b', 'a']);
});
it('posts one legacy batch with an idempotency key on an insecure origin', async () => {
  vi.spyOn(client, 'post').mockResolvedValue({});
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
  const body = {
    createOrder: false,
    requisitionsToRelease: [{ requisitionId: 'r', supplyingDepotId: 'd' }],
  };
  await releaseRequisitions(body);
  expect(client.post).toHaveBeenCalledExactlyOnceWith('/requisitions/batchReleases', body, {
    headers: { 'Idempotency-Key': expect.any(String) },
  });
});
