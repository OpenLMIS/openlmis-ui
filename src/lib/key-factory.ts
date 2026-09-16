/** Creates a standard set of TanStack Query keys for a feature scope. */
const createQueryKeys = <T extends string>(scope: T) => ({
  all: [scope] as const,
  list: (params?: Record<string, unknown>) => [scope, 'list', params] as const,
  detail: (id: string) => [scope, 'detail', id] as const,
});

/**
 * Centralized query keys for all features.
 */
export const queryKeys = {
  customers: createQueryKeys('customers'),
  users: createQueryKeys('users'),
} as const;
