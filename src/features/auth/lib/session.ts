import { useLoginData } from '@/features/auth/store/login-data';

/** The user signed out, or someone else signed in, while a request waited for the session. */
export class SessionEndedError extends Error {
  constructor() {
    super('The session ended before the request could be sent.');
    this.name = 'SessionEndedError';
  }
}

type LoginState = ReturnType<typeof useLoginData.getState>;

/** Resolves with a live token for `userId`, waiting while the session is expired. */
export function waitForSession(userId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const settle = (state: LoginState) => {
      if (!state.isAuthenticated || state.referenceDataUserId !== userId) {
        unsubscribe();
        reject(new SessionEndedError());
        return true;
      }
      if (state.accessToken && !state.expired) {
        unsubscribe();
        resolve(state.accessToken);
        return true;
      }
      return false;
    };

    if (!settle(useLoginData.getState())) unsubscribe = useLoginData.subscribe(settle);
  });
}
