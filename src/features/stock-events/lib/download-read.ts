import { AxiosError, isAxiosError } from 'axios';
import { OFFLINE_FRESH_FOR } from '@/lib/offline-freshness';

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
