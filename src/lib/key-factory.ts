export const createQueryKeys = <T extends string>(scope: T) => ({
  all: [scope] as const,
  list: (params?: Record<string, unknown>) => [scope, 'list', params] as const,
  detail: (id: string) => [scope, 'detail', id] as const,
});

/** Register each feature's scope here, e.g. `facilities: createQueryKeys('facilities')`. */
export const queryKeys = {
  appConfiguration: createQueryKeys('appConfiguration'),
  auth: createQueryKeys('auth'),
  availableRequisitionColumns: createQueryKeys('availableRequisitionColumns'),
  facilities: createQueryKeys('facilities'),
  facilityOperators: createQueryKeys('facilityOperators'),
  facilityTypeApprovedProducts: createQueryKeys('facilityTypeApprovedProducts'),
  facilityTypes: createQueryKeys('facilityTypes'),
  geographicLevels: createQueryKeys('geographicLevels'),
  geographicZones: createQueryKeys('geographicZones'),
  home: createQueryKeys('home'),
  localeSettings: createQueryKeys('localeSettings'),
  lots: createQueryKeys('lots'),
  orderableDisplayCategories: createQueryKeys('orderableDisplayCategories'),
  orderables: createQueryKeys('orderables'),
  organizations: createQueryKeys('organizations'),
  physicalInventories: createQueryKeys('physicalInventories'),
  physicalInventoryProducts: createQueryKeys('physicalInventoryProducts'),
  processingPeriods: createQueryKeys('processingPeriods'),
  processingSchedules: createQueryKeys('processingSchedules'),
  profile: createQueryKeys('profile'),
  programs: createQueryKeys('programs'),
  reasons: createQueryKeys('reasons'),
  rejectionReasonCategories: createQueryKeys('rejectionReasonCategories'),
  rejectionReasons: createQueryKeys('rejectionReasons'),
  requisitions: createQueryKeys('requisitions'),
  requisitionGroups: createQueryKeys('requisitionGroups'),
  requisitionTemplates: createQueryKeys('requisitionTemplates'),
  requisitionUnskipSetting: createQueryKeys('requisitionUnskipSetting'),
  rights: createQueryKeys('rights'),
  roles: createQueryKeys('roles'),
  serviceAccounts: createQueryKeys('serviceAccounts'),
  stockCards: createQueryKeys('stockCards'),
  stockCardSummaries: createQueryKeys('stockCardSummaries'),
  stockEvents: createQueryKeys('stockEvents'),
  supplyLines: createQueryKeys('supplyLines'),
  supervisoryNodes: createQueryKeys('supervisoryNodes'),
  supplyPartners: createQueryKeys('supplyPartners'),
  tradeItems: createQueryKeys('tradeItems'),
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

export const deviceQueryKey = (key: readonly unknown[]) => [...key, 'device'] as const;

export const stockCardDeviceKey = (id: string) => deviceQueryKey(queryKeys.stockCards.detail(id));
export const stockPickerFacilitiesKey = () =>
  [...queryKeys.facilities.all, 'minimal', 'stock-picker'] as const;

export const homeStockBundleKeys = {
  products: (ids: string[], generation: string) =>
    ['home-stock-bundle', generation, 'products', ids.toSorted()] as const,
  lots: (ids: string[], generation: string) =>
    ['home-stock-bundle', generation, 'lots', ids.toSorted()] as const,
  cards: (filter: Record<string, unknown>) =>
    [...queryKeys.stockEvents.list(filter), 'home-stock-bundle'] as const,
  reasons: (filter: Record<string, unknown>) =>
    [...queryKeys.validReasons.list(filter), 'home-stock-bundle'] as const,
};
