import { type LoginDataStore, useLoginData } from '@/features/auth/store/login-data';

/** The user signed out, or someone else signed in, while a request waited for the session. */
export class SessionEndedError extends Error {
  constructor() {
    super('The session ended before the request could be sent.');
    this.name = 'SessionEndedError';
  }
}

/** Resolves with a live token for `userId`, waiting while the session is expired. */
export function waitForSession(userId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const settle = (state: LoginDataStore) => {
      if (!state.isAuthenticated || state.referenceDataUserId !== userId) {
        unsubscribe();
        reject(new SessionEndedError());
      } else if (state.accessToken && !state.expired) {
        unsubscribe();
        resolve(state.accessToken);
      }
    };
    // Zustand never calls a listener as it subscribes, so `unsubscribe` is set before `settle` runs.
    const unsubscribe = useLoginData.subscribe(settle);
    settle(useLoginData.getState());
  });
}
