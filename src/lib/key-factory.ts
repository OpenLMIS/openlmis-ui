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
  facilityTypeApprovedProducts: createQueryKeys('facilityTypeApprovedProducts'),
  facilityTypes: createQueryKeys('facilityTypes'),
  geographicLevels: createQueryKeys('geographicLevels'),
  geographicZones: createQueryKeys('geographicZones'),
  home: createQueryKeys('home'),
  orderableDisplayCategories: createQueryKeys('orderableDisplayCategories'),
  orderables: createQueryKeys('orderables'),
  organizations: createQueryKeys('organizations'),
  profile: createQueryKeys('profile'),
  programs: createQueryKeys('programs'),
  rights: createQueryKeys('rights'),
  roles: createQueryKeys('roles'),
  serviceAccounts: createQueryKeys('serviceAccounts'),
  supervisoryNodes: createQueryKeys('supervisoryNodes'),
  users: createQueryKeys('users'),
  validDestinations: createQueryKeys('validDestinations'),
  validSources: createQueryKeys('validSources'),
} as const;

export const userRightsKey = (userId: string) => [...queryKeys.auth.all, 'rights', userId] as const;
