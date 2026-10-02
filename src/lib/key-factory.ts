export const createQueryKeys = <T extends string>(scope: T) => ({
  all: [scope] as const,
  list: (params?: Record<string, unknown>) => [scope, 'list', params] as const,
  detail: (id: string) => [scope, 'detail', id] as const,
});

/** Register each feature's scope here, e.g. `facilities: createQueryKeys('facilities')`. */
export const queryKeys = {
  appConfiguration: createQueryKeys('appConfiguration'),
  auth: createQueryKeys('auth'),
  facilities: createQueryKeys('facilities'),
  facilityOperators: createQueryKeys('facilityOperators'),
  facilityTypes: createQueryKeys('facilityTypes'),
  geographicZones: createQueryKeys('geographicZones'),
  home: createQueryKeys('home'),
  orderables: createQueryKeys('orderables'),
  profile: createQueryKeys('profile'),
  programs: createQueryKeys('programs'),
  rights: createQueryKeys('rights'),
  roles: createQueryKeys('roles'),
  serviceAccounts: createQueryKeys('serviceAccounts'),
  supervisoryNodes: createQueryKeys('supervisoryNodes'),
  users: createQueryKeys('users'),
} as const;

export const userRightsKey = (userId: string) => [...queryKeys.auth.all, 'rights', userId] as const;
