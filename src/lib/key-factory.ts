/** Standard TanStack Query keys for a feature scope. */
export const createQueryKeys = <T extends string>(scope: T) => ({
  all: [scope] as const,
  list: (params?: Record<string, unknown>) => [scope, 'list', params] as const,
  detail: (id: string) => [scope, 'detail', id] as const,
});

/** Register each feature's scope here, e.g. `facilities: createQueryKeys('facilities')`. */
export const queryKeys = {
  auth: createQueryKeys('auth'),
  facilities: createQueryKeys('facilities'),
  home: createQueryKeys('home'),
  users: createQueryKeys('users'),
} as const;
