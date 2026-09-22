import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { readLegacySession } from '@/features/auth/lib/legacy-session';

export type LoginData = {
  referenceDataUserId: string;
  username: string;
  accessToken: string;
};

/** Where the current session came from. Only a borrowed one follows the lender out. */
export type SessionSource = 'own' | 'legacy';

type LoginDataStore = {
  referenceDataUserId: string | null;
  username: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  sessionSource: SessionSource | null;
  setLoginData: (loginData: LoginData, source?: SessionSource) => void;
  clearLoginData: () => void;
};

// Read outside React via `getState()` by the axios interceptors and route guards.
export const useLoginData = create<LoginDataStore>()(
  persist(
    (set) => ({
      referenceDataUserId: null,
      username: null,
      accessToken: null,
      isAuthenticated: false,
      sessionSource: null,
      setLoginData: ({ referenceDataUserId, username, accessToken }, source = 'own') =>
        set({
          referenceDataUserId,
          username,
          accessToken,
          isAuthenticated: !!accessToken,
          sessionSource: accessToken ? source : null,
        }),
      clearLoginData: () =>
        set({
          referenceDataUserId: null,
          username: null,
          accessToken: null,
          isAuthenticated: false,
          sessionSource: null,
        }),
    }),
    { name: 'login-data-storage' },
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

  useLoginData.getState().clearLoginData();
  if (legacy) useLoginData.getState().setLoginData(legacy, 'legacy');

  return true;
}
