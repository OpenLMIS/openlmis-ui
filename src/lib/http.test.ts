import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '@/integrations/axios';
import { getIfExists, isConflict, isNotFound, isOfflineError, isRefused } from '@/lib/http';
import { networkError } from '@/tests/http-error';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

const get = vi.mocked(client.get);

const failed = (status: number) =>
  new AxiosError('failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

beforeEach(() => get.mockReset());

describe('isNotFound', () => {
  it('is true only for a 404 from the server', () => {
    expect(isNotFound(failed(404))).toBe(true);
    expect(isNotFound(failed(500))).toBe(false);
    expect(isNotFound(new Error('offline'))).toBe(false);
  });
});

describe('isConflict', () => {
  it('is a save refused because someone else saved first', () => {
    expect(isConflict(failed(409))).toBe(true);
    expect(isConflict(failed(400))).toBe(false);
    expect(isConflict(new Error('409'))).toBe(false);
  });
});

describe('isRefused', () => {
  it('is true only for a 403 from the server', () => {
    expect(isRefused(failed(403))).toBe(true);
    expect(isRefused(failed(401))).toBe(false);
    expect(isRefused(new Error('offline'))).toBe(false);
  });
});

describe('isOfflineError', () => {
  it('is true for a request that never got an answer', () => {
    expect(isOfflineError(networkError())).toBe(true);
  });

  it('is false for an answer from the server, a timeout or anything else', () => {
    expect(isOfflineError(failed(500))).toBe(false);
    expect(isOfflineError(failed(401))).toBe(false);
    expect(isOfflineError(new AxiosError('timeout', AxiosError.ECONNABORTED))).toBe(false);
    expect(isOfflineError(new Error('Network Error'))).toBe(false);
  });
});

describe('getIfExists', () => {
  it('returns what the server sent', async () => {
    get.mockResolvedValueOnce({ data: { id: 'u1' } });
    await expect(getIfExists('/users/u1')).resolves.toEqual({ id: 'u1' });
  });

  it('returns null for a record that does not exist', async () => {
    get.mockRejectedValueOnce(failed(404));
    await expect(getIfExists('/userContactDetails/u1')).resolves.toBeNull();
  });

  it('passes any other failure on', async () => {
    const error = failed(500);
    get.mockRejectedValueOnce(error);
    await expect(getIfExists('/users/u1')).rejects.toBe(error);
  });
});
