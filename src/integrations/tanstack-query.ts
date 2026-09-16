import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default is 3 - too aggressive for broken endpoints. 1 keeps resilience for transient network hiccups without hanging the UI.
      retry: 1,
      // Opinionated: focus-refetches surprise users and cause data flicker. Flip this (or override per-query) if you want fresh data after tab switches.
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Never retry writes automatically - could duplicate actions (double-post, etc.).
      retry: 0,
    },
  },
});
