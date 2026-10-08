import type {
  Facility,
  FacilityOperator,
  FacilityType,
  GeographicLevel,
  GeographicZone,
  LotSummary,
  MinimalFacility,
  Orderable,
  OrderableDisplayCategory,
  Organization,
  Program,
  Reason,
  Role,
  SupervisoryNode,
} from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';
import type { UserRecord } from '@/lib/user-types';

/** Every facility in one request; the endpoint is meant for pickers and has no paging worth using. */
export async function fetchMinimalFacilities(): Promise<MinimalFacility[]> {
  const { data } = await client.get<Page<MinimalFacility>>('/facilities/minimal');
  return data.content;
}

/** One facility, for showing its name without loading every facility. */
export async function fetchFacility(id: string): Promise<Facility> {
  const { data } = await client.get<Facility>(`/facilities/${id}`);
  return data;
}

/** The given facilities in one request; no ids would list every facility, so none is sent. */
export async function fetchFacilitiesByIds(ids: readonly string[]): Promise<Facility[]> {
  if (ids.length === 0) return [];
  const { data } = await client.get<Page<Facility>>('/facilities', {
    params: { id: ids },
    paramsSerializer: { indexes: null },
  });
  return data.content;
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

const BY_IDS_BATCH = 100;

/** The records with the given ids, at most 100 ids a request and every page of each; none is sent for no ids, which would list them all. */
async function fetchByIds<T extends { id: string }>(path: string, ids: readonly string[]) {
  const unique = [...new Set(ids)];
  const found: T[] = [];
  for (let start = 0; start < unique.length; start += BY_IDS_BATCH) {
    const batch = unique.slice(start, start + BY_IDS_BATCH);
    for (let page = 0; ; page += 1) {
      const { data } = await client.get<Page<T>>(path, {
        params: { id: batch, page, size: BY_IDS_BATCH },
        paramsSerializer: { indexes: null },
      });
      found.push(...data.content);
      if (page + 1 >= data.totalPages) break;
    }
  }
  return found;
}

const versionOf = (orderable: Orderable) => orderable.meta?.versionNumber ?? 0;

function latestVersions(orderables: readonly Orderable[]) {
  const latest = new Map<string, Orderable>();
  for (const orderable of orderables) {
    const kept = latest.get(orderable.id);
    if (!kept || versionOf(orderable) > versionOf(kept)) latest.set(orderable.id, orderable);
  }
  return [...latest.values()];
}

export async function fetchOrderablesByIds(ids: readonly string[]): Promise<Orderable[]> {
  return latestVersions(await fetchByIds<Orderable>('/orderables', ids));
}

export function fetchLotsByIds(ids: readonly string[]): Promise<LotSummary[]> {
  return fetchByIds<LotSummary>('/lots', ids);
}

export async function fetchUserRecord(id: string): Promise<UserRecord> {
  const { data } = await client.get<UserRecord>(`/users/${id}`);
  return data;
}

export async function fetchUserPrograms(id: string): Promise<Program[]> {
  const { data } = await client.get<Program[]>(`/users/${id}/programs`);
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
  return latestVersions(found);
}

const TIME_ZONE_KEY = 'openlmis-ui.time-zone';

export const storedTimeZone = () => localStorage.getItem(TIME_ZONE_KEY);

export async function fetchDeploymentTimeZone(): Promise<string> {
  const { data } = await client.get<{ timeZoneId?: string | null }>('/localeSettings', {
    baseURL: '/',
    anonymous: true,
    timeout: 10_000,
  });
  if (!data.timeZoneId) throw new Error('No time zone in the locale settings');
  localStorage.setItem(TIME_ZONE_KEY, data.timeZoneId);
  return data.timeZoneId;
}
