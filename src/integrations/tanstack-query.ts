import { QueryClient } from '@tanstack/react-query';
import { useLoginData } from '@/features/auth/store/login-data';
import { isRefused, isUnauthorized } from '@/lib/http';

/** One more try for a failure that may pass, none for a refusal that will not. */
export function shouldRetry(failureCount: number, error: unknown) {
  return failureCount < 1 && !isUnauthorized(error) && !isRefused(error);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Hovering a link preloads its route; without this, the click would fetch the same data again.
      staleTime: 30_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Retrying a write could duplicate it.
      retry: 0,
    },
  },
});

// Cached data belongs to whoever fetched it, so signing out or in as someone else drops all of it.
useLoginData.subscribe((state, previous) => {
  if (state.referenceDataUserId !== previous.referenceDataUserId) queryClient.clear();
});
