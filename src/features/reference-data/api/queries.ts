import { queryOptions } from '@tanstack/react-query';
import {
  type ApprovedProductsFilter,
  type FacilityProgramFilter,
  type FacilityTypeApprovedOrderablesFilter,
  fetchApprovedProducts,
  fetchDeploymentTimeZone,
  fetchFacilitiesByIds,
  fetchFacility,
  fetchFacilityOperators,
  fetchFacilityOrderableFulfills,
  fetchFacilityTypeApprovedOrderables,
  fetchFacilityTypes,
  fetchGeographicLevels,
  fetchGeographicZones,
  fetchLotsByIds,
  fetchLotsByTradeItems,
  fetchMinimalFacilities,
  fetchOrderableDisplayCategories,
  fetchOrderableFulfills,
  fetchOrderables,
  fetchOrderablesByIdentities,
  fetchOrderablesByIds,
  fetchOrderablesByTradeItems,
  fetchOrganizations,
  fetchProcessingSchedules,
  fetchPrograms,
  fetchReasons,
  fetchRejectionReasonCategories,
  fetchRejectionReasons,
  fetchRoles,
  fetchSupervisedFacilities,
  fetchSupervisoryNodes,
  fetchSupervisoryNodesByIds,
  fetchTradeItemByGtin,
  fetchUserPrograms,
  fetchUserRecord,
  fetchValidAssignments,
  fetchValidReasons,
  type OrderableIdentity,
  type OrderableSearch,
  type SupervisedFacilitiesFilter,
  storedTimeZone,
  type ValidAssignmentsFilter,
} from '@/features/reference-data/api/api';
import type { ValidReasonsFilter } from '@/features/reference-data/lib/types';
import { deviceQuery } from '@/lib/device-query';
import {
  queryKeys,
  stockPickerFacilitiesKey,
  userProgramsKey,
  userRecordKey,
} from '@/lib/key-factory';
import { offlineAccessQuery, readOfflineAccess, withOfflineAccess } from '@/lib/offline-access';

// Lookups that rarely change, so one fetch serves every screen for a while.
export const LOOKUP_STALE_TIME = 10 * 60 * 1000;

export const minimalFacilitiesOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.facilities.all, 'minimal'] as const,
    queryFn: fetchMinimalFacilities,
    staleTime: LOOKUP_STALE_TIME,
  });

export const stockPickerFacilitiesOptions = (online: boolean) =>
  deviceQuery({
    queryKey: stockPickerFacilitiesKey(),
    online,
    server: fetchMinimalFacilities,
    device: async () => {
      const saved = await readOfflineAccess();
      return saved.homeFacility
        ? [{ ...saved.homeFacility, name: saved.homeFacility.name ?? saved.homeFacility.code }]
        : [];
    },
    staleTime: 5 * 60 * 1000,
  });

export const facilityOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.facilities.detail(id),
    queryFn: () => fetchFacility(id),
    staleTime: LOOKUP_STALE_TIME,
  });

export const homeFacilityOptions = (id: string) =>
  queryOptions({
    queryKey: [...queryKeys.facilities.all, 'home', id] as const,
    queryFn: () =>
      withOfflineAccess(
        () => fetchFacility(id),
        (saved) => (saved.homeFacility?.id === id ? saved.homeFacility : undefined),
      ),
    ...offlineAccessQuery(LOOKUP_STALE_TIME),
  });

export const facilitiesByIdsOptions = (ids: readonly string[]) =>
  queryOptions({
    queryKey: [...queryKeys.facilities.all, 'byIds', ids] as const,
    queryFn: () => fetchFacilitiesByIds(ids),
    staleTime: LOOKUP_STALE_TIME,
  });

export const rolesOptions = () =>
  queryOptions({
    queryKey: queryKeys.roles.list(),
    queryFn: fetchRoles,
    staleTime: LOOKUP_STALE_TIME,
  });

export const programsOptions = () =>
  queryOptions({
    queryKey: queryKeys.programs.list(),
    queryFn: fetchPrograms,
    staleTime: LOOKUP_STALE_TIME,
  });

export const supervisoryNodesOptions = () =>
  queryOptions({
    queryKey: queryKeys.supervisoryNodes.list(),
    queryFn: fetchSupervisoryNodes,
    staleTime: LOOKUP_STALE_TIME,
  });

export const supervisoryNodesByIdsOptions = (ids: readonly string[]) =>
  queryOptions({
    queryKey: [...queryKeys.supervisoryNodes.all, 'byIds', ids] as const,
    queryFn: () => fetchSupervisoryNodesByIds(ids),
    staleTime: LOOKUP_STALE_TIME,
  });

export const supervisedFacilitiesOptions = (filter: SupervisedFacilitiesFilter) =>
  queryOptions({
    queryKey: [...queryKeys.supervisoryNodes.all, 'facilities', filter] as const,
    queryFn: () => fetchSupervisedFacilities(filter),
    staleTime: LOOKUP_STALE_TIME,
  });

export const facilityTypeApprovedOrderablesOptions = (
  filter: FacilityTypeApprovedOrderablesFilter,
) => {
  const normalized = {
    ...filter,
    facilityTypeCodes: [...new Set(filter.facilityTypeCodes)].sort(),
  };
  return queryOptions({
    queryKey: [...queryKeys.facilityTypeApprovedProducts.all, 'types', normalized] as const,
    queryFn: () => fetchFacilityTypeApprovedOrderables(normalized),
    staleTime: LOOKUP_STALE_TIME,
  });
};

export const facilityTypesOptions = (filter: { active?: boolean } = {}) =>
  queryOptions({
    queryKey: [...queryKeys.facilityTypes.all, 'lookup', filter] as const,
    queryFn: () => fetchFacilityTypes(filter),
    staleTime: LOOKUP_STALE_TIME,
  });

export const orderableDisplayCategoriesOptions = () =>
  queryOptions({
    queryKey: queryKeys.orderableDisplayCategories.list(),
    queryFn: fetchOrderableDisplayCategories,
    staleTime: LOOKUP_STALE_TIME,
  });

export const geographicZonesOptions = () =>
  queryOptions({
    queryKey: queryKeys.geographicZones.list(),
    queryFn: fetchGeographicZones,
    staleTime: LOOKUP_STALE_TIME,
  });

export const facilityOperatorsOptions = () =>
  queryOptions({
    queryKey: queryKeys.facilityOperators.list(),
    queryFn: fetchFacilityOperators,
    staleTime: LOOKUP_STALE_TIME,
  });

export const geographicLevelsOptions = () =>
  queryOptions({
    queryKey: queryKeys.geographicLevels.list(),
    queryFn: fetchGeographicLevels,
    staleTime: LOOKUP_STALE_TIME,
  });

export const organizationsOptions = () =>
  queryOptions({
    queryKey: queryKeys.organizations.list(),
    queryFn: fetchOrganizations,
    staleTime: LOOKUP_STALE_TIME,
  });

export const reasonsOptions = () =>
  queryOptions({
    queryKey: queryKeys.reasons.list(),
    queryFn: fetchReasons,
    staleTime: LOOKUP_STALE_TIME,
  });

export const orderablesSearchOptions = (search: OrderableSearch) => {
  const trimmed = {
    ...search,
    name: search.name?.trim() ?? '',
    code: search.code?.trim() ?? '',
  };
  return queryOptions({
    queryKey: queryKeys.orderables.list(trimmed),
    queryFn: () => fetchOrderables(trimmed),
  });
};

export const orderablesByIdsOptions = (ids: readonly string[]) =>
  queryOptions({
    queryKey: queryKeys.orderables.list({ ids: ids.toSorted() }),
    queryFn: () => fetchOrderablesByIds(ids),
    staleTime: LOOKUP_STALE_TIME,
  });

export const orderablesByTradeItemsOptions = (tradeItemIds: readonly string[]) =>
  queryOptions({
    queryKey: queryKeys.orderables.list({ tradeItemIds: tradeItemIds.toSorted() }),
    queryFn: () => fetchOrderablesByTradeItems(tradeItemIds),
  });

export const orderablesByIdentitiesOptions = (identities: readonly OrderableIdentity[]) => {
  const unique = [
    ...new Map(identities.map((item) => [`${item.id}|${item.versionNumber}`, item])).values(),
  ].sort((a, b) => a.id.localeCompare(b.id) || a.versionNumber - b.versionNumber);
  return queryOptions({
    queryKey: queryKeys.orderables.list({ identities: unique }),
    queryFn: () => fetchOrderablesByIdentities(unique),
    staleTime: LOOKUP_STALE_TIME,
  });
};

export const lotsByIdsOptions = (ids: readonly string[]) =>
  queryOptions({
    queryKey: queryKeys.lots.list({ ids: ids.toSorted() }),
    queryFn: () => fetchLotsByIds(ids),
    staleTime: LOOKUP_STALE_TIME,
  });

export const lotsByTradeItemsOptions = (tradeItemIds: readonly string[]) =>
  queryOptions({
    queryKey: queryKeys.lots.list({ tradeItemIds }),
    queryFn: () => fetchLotsByTradeItems(tradeItemIds),
  });

export const approvedProductsOptions = (filter: ApprovedProductsFilter) =>
  queryOptions({
    queryKey: [...queryKeys.facilityTypeApprovedProducts.all, 'facility', filter] as const,
    queryFn: () => fetchApprovedProducts(filter),
  });

export const orderableFulfillsOptions = (ids: readonly string[]) =>
  queryOptions({
    queryKey: [...queryKeys.orderables.all, 'fulfills', { ids: ids.toSorted() }] as const,
    queryFn: () => fetchOrderableFulfills(ids),
    staleTime: LOOKUP_STALE_TIME,
  });

export const facilityOrderableFulfillsOptions = (filter: FacilityProgramFilter) =>
  queryOptions({
    queryKey: [...queryKeys.orderables.all, 'fulfills', filter] as const,
    queryFn: () => fetchFacilityOrderableFulfills(filter),
    staleTime: LOOKUP_STALE_TIME,
  });

/** The user as the reference data holds them; not `users.detail`, which holds the Users page's richer record. */
export const userRecordOptions = (id: string) =>
  queryOptions({
    queryKey: userRecordKey(id),
    queryFn: () =>
      withOfflineAccess(
        () => fetchUserRecord(id),
        (saved) => (saved.userId === id ? saved.user : undefined),
      ),
    ...offlineAccessQuery(LOOKUP_STALE_TIME),
  });

export const userProgramsOptions = (id: string) =>
  queryOptions({
    queryKey: userProgramsKey(id),
    queryFn: () =>
      withOfflineAccess(
        () => fetchUserPrograms(id),
        (saved) => (saved.userId === id ? saved.programs : undefined),
      ),
    ...offlineAccessQuery(LOOKUP_STALE_TIME),
  });

type DeploymentTimeZone = { zone: string; read: boolean };

export const deploymentTimeZoneOptions = () =>
  queryOptions({
    queryKey: queryKeys.localeSettings.all,
    queryFn: async (): Promise<DeploymentTimeZone> => {
      try {
        return { zone: await fetchDeploymentTimeZone(), read: true };
      } catch {
        return { zone: storedTimeZone() ?? 'UTC', read: false };
      }
    },
    initialData: () => {
      const zone = storedTimeZone();
      return zone ? { zone, read: false } : undefined;
    },
    initialDataUpdatedAt: 0,
    staleTime: (query) => (query.state.data?.read ? Number.POSITIVE_INFINITY : 0),
  });

export const validReasonsOptions = (filter: ValidReasonsFilter) =>
  queryOptions({
    queryKey: queryKeys.validReasons.list(filter),
    queryFn: () => fetchValidReasons(filter),
    staleTime: LOOKUP_STALE_TIME,
  });

export const tradeItemByGtinOptions = (gtin: string) =>
  queryOptions({
    queryKey: queryKeys.tradeItems.list({ gtin }),
    queryFn: () => fetchTradeItemByGtin(gtin),
    staleTime: LOOKUP_STALE_TIME,
  });

export const validAssignmentsOptions = (
  resource: 'validSources' | 'validDestinations',
  filter: ValidAssignmentsFilter,
) =>
  queryOptions({
    queryKey: [...queryKeys[resource].all, 'lookup', filter] as const,
    queryFn: () => fetchValidAssignments(resource, filter),
    staleTime: LOOKUP_STALE_TIME,
  });

export const validDestinationsOptions = (filter: ValidAssignmentsFilter) =>
  validAssignmentsOptions('validDestinations', filter);

export const validSourcesOptions = (filter: ValidAssignmentsFilter) =>
  validAssignmentsOptions('validSources', filter);

export const processingSchedulesOptions = () =>
  queryOptions({
    queryKey: queryKeys.processingSchedules.list(),
    queryFn: fetchProcessingSchedules,
    staleTime: LOOKUP_STALE_TIME,
  });

export const rejectionReasonCategoriesOptions = () =>
  queryOptions({
    queryKey: queryKeys.rejectionReasonCategories.list(),
    queryFn: fetchRejectionReasonCategories,
    staleTime: LOOKUP_STALE_TIME,
  });

export const rejectionReasonsOptions = () =>
  queryOptions({
    queryKey: queryKeys.rejectionReasons.list(),
    queryFn: fetchRejectionReasons,
    staleTime: LOOKUP_STALE_TIME,
  });
