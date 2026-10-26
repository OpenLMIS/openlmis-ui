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
  device: (serverError?: unknown) => Promise<T>,
  canFallback: (error: unknown) => boolean = isAccessFallbackError,
): Promise<T> {
  const scope = getSessionScope();
  let serverError: unknown;
  if (isOnline()) {
    try {
      const result = await online();
      assertSessionScope(scope);
      return result;
    } catch (error) {
      assertSessionScope(scope);
      if (!canFallback(error)) throw error;
      serverError = error;
    }
  }
  const result = await device(serverError);
  assertSessionScope(scope);
  if (typeof result === 'object' && result !== null)
    deviceResults.set(result, getConnectionGeneration());
  return result;
}
