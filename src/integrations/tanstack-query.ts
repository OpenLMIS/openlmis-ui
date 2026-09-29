import { QueryClient } from '@tanstack/react-query';
import { useLoginData } from '@/features/auth/store/login-data';
import { isOfflineError, isRefused, isUnauthorized } from '@/lib/http';
import { isOnline } from '@/lib/online';

export function shouldRetry(failureCount: number, error: unknown) {
  if (isOfflineError(error) && !isOnline()) return false;
  return failureCount < 1 && !isUnauthorized(error) && !isRefused(error);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Hovering a link preloads its route; without this, the click would fetch the same data again.
      staleTime: 30_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
      networkMode: 'always',
    },
    mutations: {
      // Retrying a write could duplicate it.
      retry: 0,
      networkMode: 'always',
    },
  },
});

// Cached data belongs to whoever fetched it, so signing out or in as someone else drops all of it.
useLoginData.subscribe((state, previous) => {
  if (state.referenceDataUserId !== previous.referenceDataUserId) queryClient.clear();
});
