import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LEGACY_SESSION_STORAGE_KEYS, readLegacySession } from '@/features/auth/lib/legacy-session';

export type LoginData = {
  referenceDataUserId: string;
  username: string;
  accessToken: string;
  /** Seconds the token had left when it was issued; the server extends it on every call. */
  expiresIn?: number;
};

/** Where the current session came from. Only a borrowed one follows the lender out. */
export type SessionSource = 'own' | 'legacy';

export type LoginDataStore = {
  referenceDataUserId: string | null;
  username: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  sessionSource: SessionSource | null;
  legacyTokenUserId: string | null;
  /** The server refused the token; the user is still known, and signs in again to carry on. */
  expired: boolean;
  /** The earliest the token could expire, since the server slides it with use. */
  expiresAt: number | null;
  setLoginData: (loginData: LoginData, source?: SessionSource) => void;
  expireSession: () => void;
  clearLoginData: () => void;
};

const LOGIN_DATA_STORAGE_KEY = 'login-data-storage';

// Read outside React via `getState()` by the axios interceptors and route guards.
export const useLoginData = create<LoginDataStore>()(
  persist(
    (set, get) => ({
      referenceDataUserId: null,
      username: null,
      accessToken: null,
      isAuthenticated: false,
      sessionSource: null,
      legacyTokenUserId: null,
      expired: false,
      expiresAt: null,
      setLoginData: ({ referenceDataUserId, username, accessToken, expiresIn }, source = 'own') =>
        set({
          referenceDataUserId,
          username,
          accessToken,
          isAuthenticated: !!accessToken,
          sessionSource: accessToken ? source : null,
          legacyTokenUserId: source === 'legacy' ? referenceDataUserId : null,
          expired: false,
          expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
        }),
      // The refused token is kept, so the legacy UI still holding it is not mistaken for a new one.
      expireSession: () => {
        const { isAuthenticated, accessToken, expired } = get();
        if (!isAuthenticated) return;
        const saved = savedSession();
        if (saved?.accessToken && saved.accessToken !== accessToken && !saved.expired) {
          void useLoginData.persist.rehydrate();
        } else if (!expired) {
          set({ expired: true, expiresAt: null });
        }
      },
      clearLoginData: () =>
        set({
          referenceDataUserId: null,
          username: null,
          accessToken: null,
          isAuthenticated: false,
          sessionSource: null,
          legacyTokenUserId: null,
          expired: false,
          expiresAt: null,
        }),
    }),
    { name: LOGIN_DATA_STORAGE_KEY },
  ),
);

function savedSession(): Partial<LoginDataStore> | undefined {
  const saved = useLoginData.persist.getOptions().storage?.getItem(LOGIN_DATA_STORAGE_KEY);
  return saved && !(saved instanceof Promise) ? saved.state : undefined;
}

export function syncLegacySession(): boolean {
  const {
    isAuthenticated,
    referenceDataUserId,
    accessToken,
    sessionSource,
    expired,
    legacyTokenUserId,
  } = useLoginData.getState();
  const legacy = readLegacySession();

  if (!isAuthenticated) {
    if (!legacy) return false;
    useLoginData.getState().setLoginData(legacy, 'legacy');
    return true;
  }

  if (sessionSource !== 'legacy') return false;

  if (!legacy) {
    useLoginData.getState().expireSession();
    return !expired;
  }

  const tokenChanged = legacy.accessToken !== accessToken;
  const userChanged = legacy.referenceDataUserId !== referenceDataUserId;
  const tokenUserId = legacyTokenUserId ?? referenceDataUserId;

  if (tokenChanged && legacy.referenceDataUserId !== tokenUserId) {
    useLoginData.getState().setLoginData(legacy, 'legacy');
    return true;
  }

  if (userChanged) {
    useLoginData.setState({
      referenceDataUserId: legacy.referenceDataUserId,
      username: legacy.username,
      legacyTokenUserId: tokenUserId,
      expired: true,
      expiresAt: null,
    });
    return true;
  }

  if (!tokenChanged) return false;
  useLoginData.getState().expireSession();
  return !expired;
}

/** Follows a change another tab made to the shared storage; resolves `true` if it signed this tab out. */
export async function syncOtherTab(key: string | null): Promise<boolean> {
  const wasAuthenticated = useLoginData.getState().isAuthenticated;

  if (key === LOGIN_DATA_STORAGE_KEY) {
    await useLoginData.persist.rehydrate();
  } else if (key === null || LEGACY_SESSION_STORAGE_KEYS.includes(key)) {
    syncLegacySession();
    // The legacy UI wipes the whole origin on a refused token; our session in memory stays ours.
    if (key === null && useLoginData.getState().isAuthenticated) useLoginData.setState({});
  }

  return wasAuthenticated && !useLoginData.getState().isAuthenticated;
}
