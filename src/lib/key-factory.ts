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
  lots: createQueryKeys('lots'),
  orderableDisplayCategories: createQueryKeys('orderableDisplayCategories'),
  orderables: createQueryKeys('orderables'),
  organizations: createQueryKeys('organizations'),
  profile: createQueryKeys('profile'),
  programs: createQueryKeys('programs'),
  reasons: createQueryKeys('reasons'),
  rights: createQueryKeys('rights'),
  roles: createQueryKeys('roles'),
  serviceAccounts: createQueryKeys('serviceAccounts'),
  stockCards: createQueryKeys('stockCards'),
  stockCardSummaries: createQueryKeys('stockCardSummaries'),
  stockEvents: createQueryKeys('stockEvents'),
  supervisoryNodes: createQueryKeys('supervisoryNodes'),
  users: createQueryKeys('users'),
  validDestinations: createQueryKeys('validDestinations'),
  validReasons: createQueryKeys('validReasons'),
  validSources: createQueryKeys('validSources'),
} as const;

export const userRightsKey = (userId: string) => [...queryKeys.auth.all, 'rights', userId] as const;

export const userRecordKey = (userId: string) =>
  [...queryKeys.users.all, 'record', userId] as const;

/** Without a user, every user's programs, as a program save refreshes them. */
export const userProgramsKey = (userId?: string) =>
  [...queryKeys.users.all, 'programs', ...(userId ? [userId] : [])] as const;
