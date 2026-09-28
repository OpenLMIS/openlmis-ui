import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LEGACY_TOKEN_STORAGE_KEY, readLegacySession } from '@/features/auth/lib/legacy-session';

export type LoginData = {
  referenceDataUserId: string;
  username: string;
  accessToken: string;
  /** Seconds the token had left when it was issued; the server extends it on every call. */
  expiresIn?: number;
};

/** Where the current session came from. Only a borrowed one follows the lender out. */
export type SessionSource = 'own' | 'legacy';

type LoginDataStore = {
  referenceDataUserId: string | null;
  username: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  sessionSource: SessionSource | null;
  /** The server refused the token; the user is still known, and signs in again to carry on. */
  expired: boolean;
  /** The earliest the token could expire, since the server slides it with use. */
  expiresAt: number | null;
  setLoginData: (loginData: LoginData, source?: SessionSource) => void;
  expireSession: () => void;
  clearLoginData: () => void;
};

export const LOGIN_DATA_STORAGE_KEY = 'login-data-storage';

// Read outside React via `getState()` by the axios interceptors and route guards.
export const useLoginData = create<LoginDataStore>()(
  persist(
    (set) => ({
      referenceDataUserId: null,
      username: null,
      accessToken: null,
      isAuthenticated: false,
      sessionSource: null,
      expired: false,
      expiresAt: null,
      setLoginData: ({ referenceDataUserId, username, accessToken, expiresIn }, source = 'own') =>
        set({
          referenceDataUserId,
          username,
          accessToken,
          isAuthenticated: !!accessToken,
          sessionSource: accessToken ? source : null,
          expired: false,
          expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
        }),
      expireSession: () =>
        set((state) =>
          state.isAuthenticated ? { accessToken: null, expired: true, expiresAt: null } : state,
        ),
      clearLoginData: () =>
        set({
          referenceDataUserId: null,
          username: null,
          accessToken: null,
          isAuthenticated: false,
          sessionSource: null,
          expired: false,
          expiresAt: null,
        }),
    }),
    { name: LOGIN_DATA_STORAGE_KEY },
  ),
);

/**
 * Keeps us in step with the legacy AngularJS UI, which shares our origin.
 *
 * Adopts its session when we have none, so crossing over is not a second login.
 * Drops ours when a session we borrowed from it disappears or changes, so its
 * logout is our logout rather than a dead token that still looks signed in. A
 * session we established ourselves is never touched.
 *
 * @returns whether our session changed
 */
export function syncLegacySession(): boolean {
  const { isAuthenticated, accessToken, sessionSource } = useLoginData.getState();
  const legacy = readLegacySession();

  if (!isAuthenticated) {
    if (!legacy) return false;

    useLoginData.getState().setLoginData(legacy, 'legacy');
    return true;
  }

  if (sessionSource !== 'legacy' || legacy?.accessToken === accessToken) return false;

  // The same user with a new token carries on, so requests waiting on the session resume.
  if (legacy?.referenceDataUserId === useLoginData.getState().referenceDataUserId) {
    useLoginData.getState().setLoginData(legacy, 'legacy');
    return true;
  }

  useLoginData.getState().clearLoginData();
  if (legacy) useLoginData.getState().setLoginData(legacy, 'legacy');

  return true;
}

/**
 * Brings this tab in step with a change another tab made to the shared storage: a sign out, a
 * sign in again, or the legacy UI wiping the whole origin, which it does on every refused token.
 */
export async function syncOtherTab(key: string | null): Promise<void> {
  if (key === LOGIN_DATA_STORAGE_KEY) {
    await useLoginData.persist.rehydrate();
    return;
  }
  if (key !== null && key !== LEGACY_TOKEN_STORAGE_KEY) return;

  syncLegacySession();
  // A wipe took our saved session too; the one in memory is still ours, so save it again.
  if (key === null && useLoginData.getState().isAuthenticated) useLoginData.setState({});
}
