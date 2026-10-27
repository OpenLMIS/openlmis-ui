import type { AxiosRequestConfig } from 'axios';
import type { ValidAssignment } from '@/components/valid-assignments/types';
import { latestOrderableVersions } from '@/features/reference-data/lib/latest-orderable-versions';
import {
  normalizeRejectionReason,
  normalizeRejectionReasonCategory,
  type RejectionReasonCategoryResponse,
  type RejectionReasonResponse,
} from '@/features/reference-data/lib/rejection-reasons';
import type {
  ApprovedProduct,
  Facility,
  FacilityOperator,
  FacilityType,
  GeographicLevel,
  GeographicZone,
  LotSummary,
  MinimalFacility,
  Orderable,
  OrderableDisplayCategory,
  OrderableFulfills,
  Organization,
  ProcessingSchedule,
  Program,
  Reason,
  RejectionReason,
  RejectionReasonCategory,
  RequisitionGroup,
  Role,
  SupervisoryNode,
  TradeItem,
  ValidReasonAssignment,
  ValidReasonsFilter,
} from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';
import { BY_IDS_BATCH, fetchByIds, fetchIdBatches } from '@/lib/fetch-by-ids';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';
import type { UserRecord } from '@/lib/user-types';

/** Every facility in one request; the endpoint is meant for pickers and has no paging worth using. */
export async function fetchMinimalFacilities(): Promise<MinimalFacility[]> {
  const { data } = await client.get<Page<MinimalFacility>>('/facilities/minimal');
  return data.content;
}

/** One facility, for showing its name without loading every facility. */
export async function fetchFacility(id: string, config?: AxiosRequestConfig): Promise<Facility> {
  const { data } = await client.get<Facility>(`/facilities/${id}`, config);
  return data;
}

export function fetchFacilitiesByIds(ids: readonly string[]) {
  return fetchByIds<Facility>('/facilities', ids);
}

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await client.get<Role[]>('/roles');
  return data;
}

export async function fetchPrograms(): Promise<Program[]> {
  const { data } = await client.get<Program[]>('/programs');
  return data;
}

/** Every node; without paging params the endpoint returns them all. */
export async function fetchSupervisoryNodes(): Promise<SupervisoryNode[]> {
  const { data } = await client.get<Page<SupervisoryNode>>('/supervisoryNodes');
  return data.content;
}

export function fetchSupervisoryNodesByIds(ids: readonly string[]) {
  return fetchByIds<SupervisoryNode>('/supervisoryNodes', ids);
}

export type SupervisedFacilitiesFilter = { parentNodeId: string; programId: string };

/** One unpaged request avoids slicing the endpoint's unordered set of facilities. */
export async function fetchSupervisedFacilities({
  parentNodeId,
  programId,
}: SupervisedFacilitiesFilter) {
  const { data } = await client.get<Page<Facility>>(
    `/supervisoryNodes/${parentNodeId}/facilities`,
    {
      params: { programId },
    },
  );
  return data.content;
}

export type FacilityTypeApprovedOrderablesFilter = {
  facilityTypeCodes: readonly string[];
  programCode: string;
};

export async function fetchFacilityTypeApprovedOrderables({
  facilityTypeCodes,
  programCode,
}: FacilityTypeApprovedOrderablesFilter): Promise<Orderable[]> {
  const types = [...new Set(facilityTypeCodes)];
  if (types.length === 0) return [];
  const { data } = await client.get<Page<ApprovedProduct>>('/facilityTypeApprovedProducts', {
    params: { facilityType: types, program: programCode },
    paramsSerializer: { indexes: null },
  });
  return latestOrderableVersions(data.content.map(({ orderable }) => orderable));
}

export async function fetchFacilityTypes(
  filter: { active?: boolean } = {},
): Promise<FacilityType[]> {
  const { data } = await client.get<Page<FacilityType>>('/facilityTypes', { params: filter });
  return data.content;
}

export async function fetchOrderableDisplayCategories(): Promise<OrderableDisplayCategory[]> {
  const { data } = await client.get<OrderableDisplayCategory[]>('/orderableDisplayCategories');
  return data.toSorted((a, b) => a.displayOrder - b.displayOrder);
}

/** Every zone, sorted by the server; without paging params the endpoint returns them all. */
export async function fetchGeographicZones(): Promise<GeographicZone[]> {
  const { data } = await client.get<Page<GeographicZone>>('/geographicZones', {
    params: { sort: 'name,asc' },
  });
  return data.content;
}

export async function fetchFacilityOperators(): Promise<FacilityOperator[]> {
  const { data } = await client.get<FacilityOperator[]>('/facilityOperators');
  return data;
}

export async function fetchGeographicLevels(): Promise<GeographicLevel[]> {
  const { data } = await client.get<GeographicLevel[]>('/geographicLevels');
  return data.toSorted((a, b) => a.levelNumber - b.levelNumber);
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const { data } = await client.get<Organization[]>('/organizations');
  return data.toSorted((a, b) => a.name.localeCompare(b.name));
}

/** Every stock reason; the endpoint cannot page, sort or filter. */
export async function fetchReasons(): Promise<Reason[]> {
  const { data } = await client.get<Reason[]>('/stockCardLineItemReasons');
  return data;
}

const ORDERABLE_SEARCH_SIZE = 20;

export type OrderableSearch = { name?: string; code?: string; page?: number; size?: number };

/** One page of products whose name and code hold the texts given; the server matches both. */
export async function fetchOrderables({
  name,
  code,
  page = 0,
  size = ORDERABLE_SEARCH_SIZE,
}: OrderableSearch) {
  const { data } = await client.get<Page<Orderable>>('/orderables', {
    params: {
      page,
      size,
      sort: 'fullProductName,asc',
      ...(name && { name }),
      ...(code && { code }),
    },
  });
  return data;
}

export async function fetchOrderablesByIds(
  ids: readonly string[],
  config?: AxiosRequestConfig,
): Promise<Orderable[]> {
  return latestOrderableVersions(await fetchByIds<Orderable>('/orderables', ids, 'id', config));
}

export type OrderableIdentity = { id: string; versionNumber: number };

export async function fetchOrderablesByIdentities(
  identities: readonly OrderableIdentity[],
): Promise<Orderable[]> {
  return latestOrderableVersions(await fetchAllOrderableVersions(identities));
}

export async function fetchAllOrderableVersions(
  identities: readonly OrderableIdentity[],
  config?: AxiosRequestConfig,
): Promise<Orderable[]> {
  const scope = config?.sessionScope ?? getSessionScope();
  const unique = [
    ...new Map(identities.map((item) => [`${item.id}|${item.versionNumber}`, item])).values(),
  ];
  const batches = await fetchIdBatches(unique, async (batch) => {
    const found: Orderable[] = [];
    for (let page = 0; ; page += 1) {
      assertSessionScope(scope);
      const { data } = await client.post<Page<Orderable>>(
        '/orderables/search',
        {
          identities: batch,
          page,
          size: BY_IDS_BATCH,
        },
        ...(config ? [config] : []),
      );
      assertSessionScope(scope);
      found.push(...data.content);
      if (page + 1 >= data.totalPages) break;
    }
    return found;
  });
  return batches.flat();
}

export function fetchLotsByIds(
  ids: readonly string[],
  config?: AxiosRequestConfig,
): Promise<LotSummary[]> {
  return fetchByIds<LotSummary>('/lots', ids, 'id', config);
}

export async function fetchLotsByTradeItems(
  ids: readonly string[],
  config?: AxiosRequestConfig,
): Promise<LotSummary[]> {
  const lots = await fetchByIds<LotSummary>('/lots', ids, 'tradeItemId', config);
  return [...new Map(lots.map((lot) => [lot.id, lot])).values()];
}

export async function fetchOrderableFulfills(ids: readonly string[]): Promise<OrderableFulfills> {
  const scope = getSessionScope();
  const unique = [...new Set(ids)];
  const fulfills: OrderableFulfills = {};
  for (let start = 0; start < unique.length; start += BY_IDS_BATCH) {
    assertSessionScope(scope);
    const { data } = await client.get<OrderableFulfills>('/orderableFulfills', {
      params: { id: unique.slice(start, start + BY_IDS_BATCH) },
      paramsSerializer: { indexes: null },
    });
    assertSessionScope(scope);
    Object.assign(fulfills, data);
  }
  return fulfills;
}

export type FacilityProgramFilter = { facilityId: string; programId: string };

export async function fetchFacilityOrderableFulfills(
  filter: FacilityProgramFilter,
  config?: AxiosRequestConfig,
): Promise<OrderableFulfills> {
  const { data } = await client.get<OrderableFulfills>('/orderableFulfills', {
    ...config,
    params: filter,
  });
  return data;
}

export type ApprovedProductsFilter = FacilityProgramFilter & {
  name?: string;
  code?: string;
  orderableIds?: readonly string[];
  page: number;
  size: number;
};

export async function fetchApprovedProducts({
  facilityId,
  programId,
  name,
  code,
  orderableIds,
  page,
  size,
}: ApprovedProductsFilter): Promise<Page<ApprovedProduct>> {
  const { data } = await client.get<Page<ApprovedProduct>>(
    `/facilities/${facilityId}/approvedProducts`,
    {
      params: {
        programId,
        ...(name && { orderableName: name }),
        ...(code && { orderableCode: code }),
        ...(orderableIds?.length && { orderableId: orderableIds }),
        page,
        size,
      },
      paramsSerializer: { indexes: null },
    },
  );
  return data;
}

export async function fetchUserRecord(
  id: string,
  config?: AxiosRequestConfig,
): Promise<UserRecord> {
  const { data } = await client.get<UserRecord>(`/users/${id}`, config);
  return data;
}

export async function fetchUserPrograms(
  id: string,
  config?: AxiosRequestConfig,
): Promise<Program[]> {
  const { data } = await client.get<Program[]>(`/users/${id}/programs`, config);
  return data;
}

const TRADE_ITEM_PAGE_SIZE = 100;

const tradeItemOf = (orderable: Orderable) => orderable.identifiers?.tradeItem?.toLowerCase();

/** The latest version of each product of the given trade items, the server sending every version. */
export async function fetchOrderablesByTradeItems(
  tradeItemIds: readonly string[],
): Promise<Orderable[]> {
  const wanted = new Set(tradeItemIds.map((id) => id.toLowerCase()));
  const found: Orderable[] = [];
  for (let page = 0; wanted.size > 0; page += 1) {
    const { data } = await client.get<Page<Orderable>>('/orderables', {
      params: { tradeItemId: tradeItemIds, page, size: TRADE_ITEM_PAGE_SIZE },
      paramsSerializer: { indexes: null },
    });
    const matching = data.content.filter((orderable) => wanted.has(tradeItemOf(orderable) ?? ''));
    // Trade items no product points to are answered with every product, not none.
    if (matching.length === 0) break;
    found.push(...matching);
    if (page + 1 >= data.totalPages) break;
  }
  return latestOrderableVersions(found);
}

export { fetchDeploymentTimeZone, storedTimeZone } from '@/lib/deployment-time-zone';

export async function fetchValidReasons(
  params: ValidReasonsFilter,
  config?: AxiosRequestConfig,
): Promise<ValidReasonAssignment[]> {
  const { data } = await client.get<ValidReasonAssignment[]>('/validReasons', {
    ...config,
    params,
  });
  return data;
}

export async function fetchTradeItemByGtin(gtin: string): Promise<TradeItem | null> {
  const { data } = await client.get<Page<TradeItem>>('/tradeItems', { params: { gtin } });
  return data.content[0] ?? null;
}

export type ValidAssignmentsFilter = { programId: string; facilityId: string };

export async function fetchValidAssignments(
  resource: 'validSources' | 'validDestinations',
  filter: ValidAssignmentsFilter,
  config?: AxiosRequestConfig,
): Promise<ValidAssignment[]> {
  const scope = config?.sessionScope ?? getSessionScope();
  const assignments: ValidAssignment[] = [];
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
    const { data } = await client.get<Page<ValidAssignment>>(`/${resource}`, {
      ...config,
      params: { ...filter, page, size: 100 },
    });
    assertSessionScope(scope);
    assignments.push(...data.content);
    if (page + 1 >= data.totalPages) break;
  }
  return assignments;
}

export function fetchTradeItemsByIds(ids: readonly string[], config?: AxiosRequestConfig) {
  return fetchByIds<TradeItem>('/tradeItems', ids, 'id', config);
}

export async function fetchProcessingSchedules(): Promise<ProcessingSchedule[]> {
  const scope = getSessionScope();
  const schedules: ProcessingSchedule[] = [];
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
    const { data } = await client.get<Page<ProcessingSchedule>>('/processingSchedules', {
      params: { page, size: 100 },
    });
    assertSessionScope(scope);
    schedules.push(...data.content);
    if (page + 1 >= data.totalPages) break;
  }
  return schedules;
}

export async function fetchRejectionReasonCategories(): Promise<RejectionReasonCategory[]> {
  const scope = getSessionScope();
  const records: RejectionReasonCategory[] = [];
  let size = 0;
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
    const { data } = await client.get<Page<RejectionReasonCategoryResponse>>(
      '/rejectionReasonCategories',
      ...(page === 0 ? [] : [{ params: { page, size } }]),
    );
    assertSessionScope(scope);
    records.push(...data.content.map(normalizeRejectionReasonCategory));
    if (page + 1 >= data.totalPages) break;
    size = data.size;
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error(
        'Cannot read the complete rejectionReasonCategories collection without a positive page size',
      );
    }
  }
  return records;
}

export async function fetchRejectionReasons(): Promise<RejectionReason[]> {
  const scope = getSessionScope();
  const records: RejectionReason[] = [];
  let size = 0;
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
    const { data } = await client.get<Page<RejectionReasonResponse>>(
      '/rejectionReasons',
      ...(page === 0 ? [] : [{ params: { page, size } }]),
    );
    assertSessionScope(scope);
    records.push(...data.content.map(normalizeRejectionReason));
    if (page + 1 >= data.totalPages) break;
    size = data.size;
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error(
        'Cannot read the complete rejectionReasons collection without a positive page size',
      );
    }
  }
  return records;
}

const PROGRAM_ORDERABLES_PAGE_SIZE = 1000;

export async function fetchProgramOrderables(
  programCode: string,
  config?: AxiosRequestConfig,
): Promise<Orderable[]> {
  const scope = config?.sessionScope ?? getSessionScope();
  const products: Orderable[] = [];
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
    const { data } = await client.get<Page<Orderable>>('/orderables', {
      ...config,
      params: { program: programCode, page, size: PROGRAM_ORDERABLES_PAGE_SIZE },
    });
    assertSessionScope(scope);
    products.push(...data.content);
    if (page + 1 >= data.totalPages) break;
  }
  return products;
}

export async function fetchRequisitionGroup(id: string): Promise<RequisitionGroup> {
  const { data } = await client.get<RequisitionGroup>(`/requisitionGroups/${id}`);
  return data;
}
