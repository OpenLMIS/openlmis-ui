import { isAccessFallbackError } from '@/lib/http';
import { isOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export class LocalDataUnavailableError extends Error {
  constructor() {
    super('Connect to download this data.');
    this.name = 'LocalDataUnavailableError';
  }
}

export async function onlineOrDevice<T>(
  online: () => Promise<T>,
  device: () => Promise<T>,
): Promise<T> {
  const scope = getSessionScope();
  if (isOnline()) {
    try {
      const result = await online();
      assertSessionScope(scope);
      return result;
    } catch (error) {
      assertSessionScope(scope);
      if (!isAccessFallbackError(error)) throw error;
    }
  }
  const result = await device();
  assertSessionScope(scope);
  return result;
}
