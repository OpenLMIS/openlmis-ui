import { queryOptions } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import {
  type ApprovedProductsFilter,
  type FacilityProgramFilter,
  type FacilityTypeApprovedOrderablesFilter,
  fetchApprovedProducts,
  fetchApprovedProductsByIdentities,
  fetchCurrencySettings,
  fetchFacilitiesByIds,
  fetchFacility,
  fetchFacilityOperators,
  fetchFacilityOrderableFulfills,
  fetchFacilitySupervisoryNodes,
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
  fetchProcessingPeriod,
  fetchProcessingSchedules,
  fetchProgramLookup,
  fetchPrograms,
  fetchReasons,
  fetchRejectionReasonCategories,
  fetchRejectionReasons,
  fetchRequisitionGroup,
  fetchRoles,
  fetchSupervisedFacilities,
  fetchSupervisoryNodes,
  fetchSupervisoryNodesByIds,
  fetchSupplyLines,
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
import { uniqueIdentities } from '@/features/reference-data/lib/identities';
import type { ValidReasonsFilter } from '@/features/reference-data/lib/types';
import { readDeploymentTimeZone } from '@/lib/deployment-time-zone';
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

export const minimalFacilitiesOptions = (config?: AxiosRequestConfig) =>
  queryOptions({
    ...(config?.backgroundDownload && { retry: false }),
    queryKey: config?.backgroundDownload
      ? ([...[...queryKeys.facilities.all, 'minimal'], 'background-download'] as const)
      : ([...queryKeys.facilities.all, 'minimal'] as const),
    queryFn: () => fetchMinimalFacilities(config),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
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

export const rolesOptions = (config?: AxiosRequestConfig) =>
  queryOptions({
    ...(config?.backgroundDownload && { retry: false }),
    queryKey: queryKeys.roles.list(),
    queryFn: () => fetchRoles(config),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });

export const programsOptions = (config?: AxiosRequestConfig) =>
  queryOptions({
    ...(config?.backgroundDownload && { retry: false }),
    queryKey: config?.backgroundDownload
      ? ([...queryKeys.programs.list(), 'background-download'] as const)
      : queryKeys.programs.list(),
    queryFn: () => fetchPrograms(config),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });

export const supervisoryNodesOptions = () =>
  queryOptions({
    queryKey: queryKeys.supervisoryNodes.list(),
    queryFn: fetchSupervisoryNodes,
    staleTime: LOOKUP_STALE_TIME,
  });

export const supervisoryNodesByIdsOptions = (
  ids: readonly string[],
  config?: AxiosRequestConfig,
  fresh = false,
) =>
  queryOptions({
    ...(config?.backgroundDownload && { retry: false }),
    queryKey: [...queryKeys.supervisoryNodes.all, 'byIds', [...new Set(ids)].sort()] as const,
    meta: { backgroundDownload: !!config?.backgroundDownload },
    queryFn: async ({
      client,
    }): Promise<Awaited<ReturnType<typeof fetchSupervisoryNodesByIds>>> => {
      if (!ids.length) return [];
      if (!fresh) {
        const covering = client
          .getQueryCache()
          .findAll({ queryKey: [...queryKeys.supervisoryNodes.all, 'byIds'] })
          .find((query) => {
            const knownIds = query.queryKey.at(-1);
            return (
              Array.isArray(knownIds) &&
              knownIds.length > ids.length &&
              ids.every((id) => knownIds.includes(id)) &&
              !query.state.isInvalidated &&
              (query.state.data || (query.promise && !query.options.meta?.backgroundDownload))
            );
          });
        if (covering) {
          const nodes = (covering.state.data ?? (await covering.promise)) as Awaited<
            ReturnType<typeof fetchSupervisoryNodesByIds>
          >;
          return nodes.filter((node) => ids.includes(node.id));
        }
      }
      return fetchSupervisoryNodesByIds([...new Set(ids)].sort(), config);
    },
    staleTime: fresh ? 0 : Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
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
  const unique = uniqueIdentities(identities, true);
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
export const userRecordOptions = (id: string, config?: AxiosRequestConfig) =>
  queryOptions({
    ...(config?.backgroundDownload && { retry: false }),
    queryKey: userRecordKey(id),
    queryFn: () =>
      withOfflineAccess(
        () => fetchUserRecord(id, config),
        (saved) => (saved.userId === id ? saved.user : undefined),
      ),
    ...offlineAccessQuery(Number.POSITIVE_INFINITY),
    gcTime: Number.POSITIVE_INFINITY,
  });

export const userProgramsOptions = (id: string, config?: AxiosRequestConfig) =>
  queryOptions({
    ...(config?.backgroundDownload && { retry: false }),
    queryKey: userProgramsKey(id),
    queryFn: () =>
      withOfflineAccess(
        () => fetchUserPrograms(id, config),
        (saved) => (saved.userId === id ? saved.programs : undefined),
      ),
    ...offlineAccessQuery(Number.POSITIVE_INFINITY),
    gcTime: Number.POSITIVE_INFINITY,
  });

type DeploymentTimeZone = { zone: string; read: boolean };

export const deploymentTimeZoneOptions = () =>
  queryOptions({
    queryKey: queryKeys.localeSettings.all,
    queryFn: async ({ client }): Promise<DeploymentTimeZone> => {
      try {
        const settings = await client.fetchQuery({ ...currencySettingsOptions(), retry: false });
        return { zone: readDeploymentTimeZone(settings), read: true };
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

export const requisitionGroupOptions = (id: string, config?: AxiosRequestConfig) =>
  queryOptions({
    ...(config?.backgroundDownload && { retry: false }),
    queryKey: queryKeys.requisitionGroups.detail(id),
    queryFn: () => fetchRequisitionGroup(id, config),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });

export const processingPeriodOptions = (id: string) =>
  queryOptions({
    queryKey: [...queryKeys.processingPeriods.all, 'lookup', id] as const,
    queryFn: () => fetchProcessingPeriod(id),
    staleTime: LOOKUP_STALE_TIME,
  });
export const programLookupOptions = (id: string) =>
  queryOptions({
    queryKey: [...queryKeys.programs.all, 'lookup', id] as const,
    queryFn: () => fetchProgramLookup(id),
    staleTime: LOOKUP_STALE_TIME,
  });
export const currencySettingsOptions = (config?: AxiosRequestConfig) =>
  queryOptions({
    ...(config?.backgroundDownload && { retry: false }),
    queryKey: config?.backgroundDownload
      ? ([...[...queryKeys.localeSettings.all, 'currency'], 'background-download'] as const)
      : ([...queryKeys.localeSettings.all, 'currency'] as const),
    queryFn: () => fetchCurrencySettings(config),
    staleTime: LOOKUP_STALE_TIME,
  });
export const approvedProductsByIdentitiesOptions = (identities: readonly OrderableIdentity[]) => {
  const unique = uniqueIdentities(identities, true);
  return queryOptions({
    queryKey: [...queryKeys.facilityTypeApprovedProducts.all, 'identities', unique] as const,
    queryFn: () => fetchApprovedProductsByIdentities(unique),
    staleTime: LOOKUP_STALE_TIME,
  });
};

export const facilitySupervisoryNodesOptions = (filter: {
  programId: string;
  facilityId: string;
}) =>
  queryOptions({
    queryKey: [...queryKeys.supervisoryNodes.all, 'facility', filter],
    queryFn: () => fetchFacilitySupervisoryNodes(filter),
    staleTime: LOOKUP_STALE_TIME,
  });
export const supplyLinesOptions = (filter: { programId: string; supervisoryNodeId: string }) =>
  queryOptions({
    queryKey: [...queryKeys.supplyLines.all, 'lookup', filter],
    queryFn: () => fetchSupplyLines(filter),
    staleTime: LOOKUP_STALE_TIME,
  });
