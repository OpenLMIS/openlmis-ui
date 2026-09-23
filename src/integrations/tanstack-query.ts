import { QueryClient } from '@tanstack/react-query';

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
