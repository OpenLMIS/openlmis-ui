import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '@/integrations/axios';
import {
  getIfExists,
  isAccessFallbackError,
  isConflict,
  isNotFound,
  isOfflineError,
  isRefused,
} from '@/lib/http';
import { networkError } from '@/tests/http-error';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

const get = vi.mocked(client.get);

const failed = (status: number) =>
  new AxiosError<unknown>('failed', String(status), undefined, undefined, {
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

describe('isAccessFallbackError', () => {
  it('allows unreachable reads but preserves definitive service errors and cancellation', () => {
    expect(isAccessFallbackError(networkError())).toBe(true);
    expect(isAccessFallbackError(new AxiosError('timeout', AxiosError.ECONNABORTED))).toBe(true);
    expect(isAccessFallbackError(new AxiosError('canceled', AxiosError.ERR_CANCELED))).toBe(false);
    expect(isAccessFallbackError(new Error('Network Error'))).toBe(false);
    for (const status of [400, 401, 403, 404, 500]) {
      expect(isAccessFallbackError(failed(status))).toBe(false);
    }
    for (const status of [502, 503, 504]) {
      for (const data of [undefined, '', '<html>Gateway unavailable</html>']) {
        const error = failed(status);
        if (error.response) error.response.data = data;
        expect(isAccessFallbackError(error)).toBe(true);
      }
      for (const data of [{ messageKey: 'service.error', message: 'Unavailable' }, {}]) {
        const error = failed(status);
        if (error.response) error.response.data = data;
        expect(isAccessFallbackError(error)).toBe(false);
      }
    }
  });
});

describe('getIfExists', () => {
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
