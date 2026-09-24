import { QueryClient } from '@tanstack/react-query';
import { useLoginData } from '@/features/auth/store/login-data';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Hovering a link preloads its route; without this, the click would fetch the same data again.
      staleTime: 30_000,
      retry: 1,
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
