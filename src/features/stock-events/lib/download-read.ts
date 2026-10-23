import { AxiosError, type AxiosRequestConfig, isAxiosError } from 'axios';
import { OFFLINE_FRESH_FOR } from '@/lib/offline-freshness';
import { isOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope, isSessionExpired } from '@/lib/session-scope';

export async function retryDownloadRead<T>(read: () => Promise<T>, check: () => void): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    check();
    try {
      const result = await read();
      check();
      return result;
    } catch (error) {
      check();
      if (attempt >= 1 || !isAxiosError(error) || error.code !== AxiosError.ECONNABORTED)
        throw error;
    }
  }
}

export const downloadIsStale = (
  value: { fetchedAt: number; stale?: boolean } | undefined,
  now = Date.now(),
) => !value || value.stale || now - value.fetchedAt >= OFFLINE_FRESH_FOR;

export function downloadReader(config: AxiosRequestConfig & { signal?: AbortSignal }) {
  const sessionScope = config.sessionScope ?? getSessionScope();
  const check = () => {
    assertSessionScope(sessionScope);
    config.signal?.throwIfAborted();
    if (config.backgroundRead && (!isOnline() || isSessionExpired()))
      throw new AxiosError('Download stopped.', AxiosError.ERR_CANCELED);
  };
  return { check, read: <T>(task: () => Promise<T>) => retryDownloadRead(task, check) };
}
