import axios, { isAxiosError } from 'axios';
import { SessionEndedError, waitForSession } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';

declare module 'axios' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: module augmentation requires interface
  interface AxiosRequestConfig {
    /** `false` for signing in and out, whose refusal is never an expired session. */
    session?: boolean;
    /** The user the request was sent for, so a refusal is never resent as someone else. */
    sentFor?: string | null;
  }
}

// Relative by default so the dev proxy decides which OpenLMIS instance is used.
export const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

const bearer = (token: string | null) => (token ? `Bearer ${token}` : undefined);

// While the session is expired a request waits for the user to sign in again rather than fail.
client.interceptors.request.use(async (config) => {
  const { accessToken, expired, referenceDataUserId } = useLoginData.getState();
  config.sentFor ??= referenceDataUserId;
  if (config.headers.Authorization) return config;

  const token =
    expired && referenceDataUserId && config.session !== false
      ? await waitForSession(referenceDataUserId)
      : accessToken;
  const authorization = bearer(token);
  if (authorization) config.headers.Authorization = authorization;

  return config;
});

// A refused token keeps the page as it is: the request waits for a new session, then is sent again.
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = isAxiosError(error) ? error.config : undefined;
    const { isAuthenticated, accessToken, expired, referenceDataUserId } = useLoginData.getState();
    if (
      error.response?.status !== 401 ||
      !config ||
      config.session === false ||
      !isAuthenticated ||
      !referenceDataUserId
    ) {
      throw error;
    }
    if (config.sentFor !== referenceDataUserId) throw new SessionEndedError();

    const current = expired ? undefined : bearer(accessToken);
    // Refused under a token that has since been replaced, so the newer session is not to blame.
    if (!current || config.headers.Authorization === current) {
      useLoginData.getState().expireSession();
    }

    config.headers.Authorization = bearer(await waitForSession(referenceDataUserId));
    return client.request(config);
  },
);
