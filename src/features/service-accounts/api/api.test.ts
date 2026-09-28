import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createServiceAccount,
  deleteServiceAccount,
  fetchServiceAccounts,
  KeyLeftBehindError,
} from '@/features/service-accounts/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);
const remove = vi.mocked(client.delete);

const key = { token: 'k1', createdBy: 'u1', createdDate: '2018-03-07T06:08:58Z' };

const failed = (status: number) =>
  new AxiosError('failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchServiceAccounts', () => {
  it('asks the auth service for one page of keys, sorted on the server', async () => {
    const page = { content: [key], totalElements: 1, totalPages: 1, number: 0, size: 10 };
    get.mockResolvedValueOnce({ data: page });

    await expect(
      fetchServiceAccounts({ page: 0, size: 10, sort: 'creationDetails.createdDate,desc' }),
    ).resolves.toEqual(page);
    expect(get).toHaveBeenCalledWith('/apiKeys', {
      params: { page: 0, size: 10, sort: 'creationDetails.createdDate,desc' },
    });
  });
});

describe('createServiceAccount', () => {
  it('creates the key, then its service account', async () => {
    post.mockResolvedValueOnce({ data: key }).mockResolvedValueOnce({ data: key });

    await expect(createServiceAccount()).resolves.toEqual(key);
    expect(post).toHaveBeenNthCalledWith(1, '/apiKeys');
    expect(post).toHaveBeenNthCalledWith(2, '/serviceAccounts', { token: 'k1' });
  });

  it('deletes the new key when its service account cannot be created, so none is left behind', async () => {
    post.mockResolvedValueOnce({ data: key }).mockRejectedValueOnce(failed(500));
    remove.mockResolvedValueOnce({});

    await expect(createServiceAccount()).rejects.toThrow('failed');
    expect(remove).toHaveBeenCalledWith('/apiKeys/k1');
  });

  it('says which key was left behind when the clean-up fails too', async () => {
    post.mockResolvedValueOnce({ data: key }).mockRejectedValueOnce(failed(500));
    remove.mockRejectedValueOnce(failed(500));

    const error = await createServiceAccount().catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(KeyLeftBehindError);
    expect(error).toMatchObject({ token: 'k1' });
  });
});

describe('deleteServiceAccount', () => {
  it('removes the service account, then the key', async () => {
    remove.mockResolvedValue({});

    await deleteServiceAccount('k1');
    expect(remove).toHaveBeenNthCalledWith(1, '/serviceAccounts/k1');
    expect(remove).toHaveBeenNthCalledWith(2, '/apiKeys/k1');
  });

  it('removes a key whose service account is already gone, as a half-finished add leaves', async () => {
    remove.mockRejectedValueOnce(failed(404)).mockResolvedValueOnce({});

    await deleteServiceAccount('k1');
    expect(remove).toHaveBeenNthCalledWith(2, '/apiKeys/k1');
  });

  it('counts a key someone else already deleted as deleted', async () => {
    remove.mockRejectedValueOnce(failed(404)).mockRejectedValueOnce(failed(404));

    await expect(deleteServiceAccount('k1')).resolves.toBeUndefined();
  });

  it('keeps the key when the service account could not be removed', async () => {
    remove.mockRejectedValueOnce(failed(500));

    await expect(deleteServiceAccount('k1')).rejects.toThrow('failed');
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
