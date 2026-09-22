import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { readLegacySession } from '@/features/auth/lib/legacy-session';

export type LoginData = {
  referenceDataUserId: string;
  username: string;
  accessToken: string;
};

type LoginDataStore = {
  referenceDataUserId: string | null;
  username: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setLoginData: (loginData: LoginData) => void;
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
      setLoginData: ({ referenceDataUserId, username, accessToken }) =>
        set({
          referenceDataUserId,
          username,
          accessToken,
          isAuthenticated: !!accessToken,
        }),
      clearLoginData: () =>
        set({
          referenceDataUserId: null,
          username: null,
          accessToken: null,
          isAuthenticated: false,
        }),
    }),
    { name: 'login-data-storage' },
  ),
);

/**
 * Carries a session over from the legacy AngularJS UI so moving between the two
 * does not mean signing in twice. Our own session always wins.
 */
export function adoptLegacySession(): boolean {
  const { isAuthenticated, setLoginData } = useLoginData.getState();
  if (isAuthenticated) return false;

  const legacy = readLegacySession();
  if (!legacy) return false;

  setLoginData(legacy);
  return true;
}
