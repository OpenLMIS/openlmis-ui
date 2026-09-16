import axios from 'axios';

export const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Request interceptor - runs before every outgoing request.
 *
 * Common things to add here:
 *   - Attach auth tokens from localStorage / cookies / auth context:
 *       const token = getAuthToken();
 *       if (token) config.headers.Authorization = `Bearer ${token}`;
 *   - Add request IDs / correlation headers for tracing
 *   - Attach CSRF tokens for mutating requests
 *
 * The onRejected handler (second arg) fires on request *setup* errors (rare - e.g. misconfigured config object), not on HTTP errors.
 */
client.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error),
);

/**
 * Response interceptor - runs after every response (success or error).
 *
 * Common things to add here:
 *   - 401 handling - clear auth state and redirect to /login:
 *       if (error.response?.status === 401) {
 *         clearAuth();
 *         router.navigate({ to: '/login' });
 *       }
 *   - Global toast notifications for 5xx errors
 *   - Token refresh flow (intercept 401, refresh, retry original request)
 *   - Unwrap standard API envelopes (e.g. return response.data.data)
 *
 * Keep it minimal - too much logic here makes individual request errors hard to reason about. Most error handling belongs in TanStack Query.
 */
client.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);
