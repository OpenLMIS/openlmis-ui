import { queryOptions } from '@tanstack/react-query';
import {
  fetchFacilitiesByIds,
  fetchFacility,
  fetchFacilityOperators,
  fetchFacilityTypes,
  fetchGeographicLevels,
  fetchGeographicZones,
  fetchLotsByIds,
  fetchMinimalFacilities,
  fetchOrderableDisplayCategories,
  fetchOrderables,
  fetchOrderablesByIds,
  fetchOrderablesByTradeItems,
  fetchOrganizations,
  fetchPrograms,
  fetchReasons,
  fetchRoles,
  fetchSupervisoryNodes,
  fetchTradeItemByGtin,
  fetchUserPrograms,
  fetchUserRecord,
  fetchValidReasons,
  type OrderableSearch,
} from '@/features/reference-data/api/api';
import type { ValidReasonsFilter } from '@/features/reference-data/lib/types';
import { queryKeys, userProgramsKey, userRecordKey } from '@/lib/key-factory';

// Lookups that rarely change, so one fetch serves every screen for a while.
const LOOKUP_STALE_TIME = 10 * 60 * 1000;

export const minimalFacilitiesOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.facilities.all, 'minimal'] as const,
    queryFn: fetchMinimalFacilities,
    staleTime: LOOKUP_STALE_TIME,
  });

export const facilityOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.facilities.detail(id),
    queryFn: () => fetchFacility(id),
    staleTime: LOOKUP_STALE_TIME,
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

export const lotsByIdsOptions = (ids: readonly string[]) =>
  queryOptions({
    queryKey: queryKeys.lots.list({ ids: ids.toSorted() }),
    queryFn: () => fetchLotsByIds(ids),
    staleTime: LOOKUP_STALE_TIME,
  });

/** The user as the reference data holds them; not `users.detail`, which holds the Users page's richer record. */
export const userRecordOptions = (id: string) =>
  queryOptions({
    queryKey: userRecordKey(id),
    queryFn: () => fetchUserRecord(id),
    staleTime: LOOKUP_STALE_TIME,
  });

export const userProgramsOptions = (id: string) =>
  queryOptions({
    queryKey: userProgramsKey(id),
    queryFn: () => fetchUserPrograms(id),
    staleTime: LOOKUP_STALE_TIME,
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
