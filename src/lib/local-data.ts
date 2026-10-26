export type DeviceSnapshot = { fetchedAt: number; generation: string };

import { isAccessFallbackError } from '@/lib/http';
import { getConnectionGeneration, isOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

const deviceResults = new WeakMap<object, number>();
export const deviceDataGeneration = (value: unknown) =>
  typeof value === 'object' && value !== null ? deviceResults.get(value) : undefined;

export class LocalDataUnavailableError extends Error {
  constructor() {
    super('Connect to download this data.');
    this.name = 'LocalDataUnavailableError';
  }
}

export function requireOnline() {
  if (!isOnline()) throw new LocalDataUnavailableError();
}

export async function onlineOrDevice<T>(
  online: () => Promise<T>,
  device: () => Promise<T>,
  canFallback: (error: unknown) => boolean = isAccessFallbackError,
): Promise<T> {
  const scope = getSessionScope();
  if (isOnline()) {
    try {
      const result = await online();
      assertSessionScope(scope);
      return result;
    } catch (error) {
      assertSessionScope(scope);
      if (!canFallback(error)) throw error;
    }
  }
  const result = await device();
  assertSessionScope(scope);
  if (typeof result === 'object' && result !== null)
    deviceResults.set(result, getConnectionGeneration());
  return result;
}
