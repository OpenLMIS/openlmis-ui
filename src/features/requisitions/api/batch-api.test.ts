import { AxiosError } from 'axios';
import { afterEach, expect, it, vi } from 'vitest';
import {
  approveBatchRequisitions,
  fetchBatchRequisitions,
  saveBatchRequisitions,
} from '@/features/requisitions/api/api';
import { batchSaveBody } from '@/features/requisitions/lib/batch';
import fp from '@/features/requisitions/lib/fixtures/batch/retrieveall-fp.json';
import { client } from '@/integrations/axios';

afterEach(() => vi.restoreAllMocks());
it('uses the three legacy batch operations and retains partial 400 payloads', async () => {
  const records = fp.requisitionDtos;
  const ids = records.map((r) => r.id).reverse();
  const get = vi.spyOn(client, 'get').mockResolvedValue({ data: fp });
  expect((await fetchBatchRequisitions(ids)).requisitionDtos.map((r) => r.id)).toEqual(ids);
  expect(get).toHaveBeenCalledWith('/requisitions', {
    params: { retrieveAll: '', id: ids.join(',') },
  });
  const body = batchSaveBody(records);
  const put = vi.spyOn(client, 'put').mockResolvedValue({ data: fp });
  await saveBatchRequisitions(body);
  expect(put).toHaveBeenCalledWith('/requisitions', body, { params: { saveAll: '' } });
  const partial = {
    requisitionDtos: [records[0]],
    requisitionErrors: [{ requisitionId: ids[0], errorMessage: { message: 'Refused' } }],
  };
  const post = vi
    .spyOn(client, 'post')
    .mockRejectedValue(
      new AxiosError('400', '400', undefined, undefined, { status: 400, data: partial } as never),
    );
  expect(await approveBatchRequisitions(ids)).toEqual(partial);
  expect(post).toHaveBeenCalledWith(
    '/requisitions',
    {},
    { params: { approveAll: '', id: ids.join(',') } },
  );
});
it('does not treat an exception-style 400 as success or retry a 5xx', async () => {
  const post = vi.spyOn(client, 'post');
  for (const status of [400, 500]) {
    const error = new AxiosError('failure', String(status), undefined, undefined, {
      status,
      data: { message: 'No records approved' },
    } as never);
    post.mockRejectedValueOnce(error);
    await expect(approveBatchRequisitions(['r'])).rejects.toBe(error);
  }
  expect(post).toHaveBeenCalledTimes(2);
});
