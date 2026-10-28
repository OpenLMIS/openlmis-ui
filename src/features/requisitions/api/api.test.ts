import { AxiosError } from 'axios';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  authorizeRequisition,
  createRequisitionActionAttempt,
  deleteRequisition,
  fetchRequisition,
  saveRequisition,
  skipRequisition,
  submitRequisition,
} from '@/features/requisitions/api/api';
import { record } from '@/features/requisitions/lib/fixtures/builders';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
const req = {
  ...record(),
  id: 'r',
  facility: { id: 'f' },
  processingPeriod: { id: 'period' },
  eTag: '"old"',
} as RequisitionRecord;
beforeEach(() => vi.clearAllMocks());
it('reads the ETag and sends it on save, adopting the response record and new ETag', async () => {
  vi.mocked(client.get).mockResolvedValue({ data: req, headers: { etag: '"read"' } });
  expect((await fetchRequisition('r')).eTag).toBe('"read"');
  vi.mocked(client.put).mockResolvedValue({
    data: { ...req, modifiedDate: 'new' },
    headers: { etag: '"new"' },
  });
  expect(await saveRequisition(req)).toMatchObject({ modifiedDate: 'new', eTag: '"new"' });
  expect(client.put).toHaveBeenCalledWith(
    '/v2/requisitions/r',
    expect.not.objectContaining({ eTag: expect.anything() }),
    { headers: { 'If-Match': '"old"' } },
  );
});
it.each([
  ['submit', submitRequisition],
  ['authorize', authorizeRequisition],
  ['skip', skipRequisition],
] as const)(
  'reuses %s keys after conflict or timeout and rotates after a definitive failure',
  async (name, action) => {
    const attempt = createRequisitionActionAttempt();
    const original = attempt.key;
    const transport = action === skipRequisition ? client.put : client.post;
    vi.mocked(transport).mockRejectedValueOnce(
      new AxiosError('conflict', undefined, undefined, undefined, { status: 409 } as never),
    );
    await expect(action('r', attempt)).rejects.toThrow();
    expect(attempt.key).toBe(original);
    vi.mocked(transport).mockRejectedValueOnce(new AxiosError('timeout', 'ECONNABORTED'));
    await expect(action('r', attempt)).rejects.toThrow();
    expect(attempt.key).toBe(original);
    vi.mocked(transport).mockRejectedValueOnce(
      new AxiosError('server error', undefined, undefined, undefined, { status: 500 } as never),
    );
    await expect(action('r', attempt)).rejects.toThrow();
    expect(attempt.key).not.toBe(original);
    vi.mocked(transport).mockResolvedValueOnce({ data: {} });
    await action('r', attempt);
    expect(transport).toHaveBeenLastCalledWith(
      `/requisitions/r/${name}`,
      {},
      { headers: { 'Idempotency-Key': attempt.key } },
    );
  },
);
it('deletes without a PUT first', async () => {
  vi.mocked(client.delete).mockResolvedValue({ status: 204 });
  await deleteRequisition('r');
  expect(client.delete).toHaveBeenCalledWith('/requisitions/r');
  expect(client.put).not.toHaveBeenCalled();
});

it('saves without If-Match when the server did not expose an ETag', async () => {
  vi.mocked(client.put).mockResolvedValue({ data: req, headers: {} });
  await saveRequisition({ ...req, eTag: undefined, modifiedDate: 'original' });
  expect(client.put).toHaveBeenCalledWith(
    '/v2/requisitions/r',
    expect.objectContaining({ modifiedDate: 'original' }),
    { headers: {} },
  );
});
