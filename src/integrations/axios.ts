import axios, { isAxiosError } from 'axios';
import { SessionEndedError, waitForSession } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

declare module 'axios' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: module augmentation requires interface
  interface AxiosRequestConfig {
    /** `false` for signing in and out, whose refusal is never an expired session. */
    session?: boolean;
    sessionScope?: number;
    /** The user the request was sent for, so a refusal is never resent as someone else. */
    sentFor?: string | null;
    /** Sent with no token, for the public password pages; the server refuses any bearer there. */
    anonymous?: boolean;
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

client.defaults.sessionScope = getSessionScope();
useLoginData.subscribe(() => {
  client.defaults.sessionScope = getSessionScope();
});

const bearer = (token: string | null) => (token ? `Bearer ${token}` : undefined);

// While the session is expired a request waits for the user to sign in again rather than fail.
client.interceptors.request.use(async (config) => {
  const { accessToken, expired, referenceDataUserId } = useLoginData.getState();
  config.sentFor ??= referenceDataUserId;
  if (config.session !== false && !config.anonymous) {
    config.sessionScope ??= getSessionScope();
    assertSessionScope(config.sessionScope);
    if (config.sentFor !== referenceDataUserId) throw new SessionEndedError();
  }
  if (config.headers.Authorization || config.anonymous) return config;

  const token =
    expired && referenceDataUserId && config.session !== false
      ? await waitForSession(referenceDataUserId)
      : accessToken;
  if (config.session !== false) assertSessionScope(config.sessionScope ?? getSessionScope());
  const authorization = bearer(token);
  if (authorization) config.headers.Authorization = authorization;

  return config;
});

// A refused token keeps the page as it is: the request waits for a new session, then is sent again.
client.interceptors.response.use(
  (response) => {
    if (response.config.session !== false && !response.config.anonymous) {
      assertSessionScope(response.config.sessionScope ?? getSessionScope());
    }
    return response;
  },
  async (error) => {
    const config = isAxiosError(error) ? error.config : undefined;
    if (config && config.session !== false && !config.anonymous) {
      assertSessionScope(config.sessionScope ?? getSessionScope());
    }
    const { isAuthenticated, accessToken, expired, referenceDataUserId } = useLoginData.getState();
    if (
      error.response?.status !== 401 ||
      !config ||
      config.session === false ||
      config.anonymous ||
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
