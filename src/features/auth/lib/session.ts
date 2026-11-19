import { onlineManager } from '@tanstack/react-query';
import { AxiosError, CanceledError } from 'axios';
import { type LoginDataStore, useLoginData } from '@/features/auth/store/login-data';
import { isOnline } from '@/lib/online';

/** The user signed out, or someone else signed in, while a request waited for the session. */
export class SessionEndedError extends Error {
  constructor() {
    super('The session ended before the request could be sent.');
    this.name = 'SessionEndedError';
  }
}

/** Waits for the same user online; offline reads can fall back to device data. */
export function waitForSession(userId: string, signal?: AbortSignal | null): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CanceledError());
      return;
    }
    const settle = (state: LoginDataStore) => {
      if (!state.isAuthenticated || state.referenceDataUserId !== userId) {
        cleanup();
        reject(new SessionEndedError());
      } else if (state.accessToken && !state.expired) {
        cleanup();
        resolve(state.accessToken);
      } else if (!isOnline()) {
        cleanup();
        reject(new AxiosError('Connect to renew this session.', AxiosError.ERR_NETWORK));
      }
    };
    // Zustand never calls a listener as it subscribes, so `unsubscribe` is set before `settle` runs.
    const unsubscribe = useLoginData.subscribe(settle);
    const unsubscribeOnline = onlineManager.subscribe(() => settle(useLoginData.getState()));
    const abort = () => {
      cleanup();
      reject(new CanceledError());
    };
    signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => {
      unsubscribe();
      unsubscribeOnline();
      signal?.removeEventListener('abort', abort);
    };
    settle(useLoginData.getState());
  });
}
