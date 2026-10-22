import {
  fetchFacilityOrderableFulfills,
  fetchLotsByIds,
  fetchLotsByTradeItems,
  fetchOrderablesByIdentities,
  fetchOrderablesByIds,
  type OrderableIdentity,
} from '@/features/reference-data/api/api';
import type { LotSummary, OrderableFulfills } from '@/features/reference-data/lib/types';
import {
  buildEligibleProducts,
  stockLineFromCard,
} from '@/features/stock-events/lib/eligible-products';
import type {
  inventorySavePayload,
  inventorySubmitPayload,
} from '@/features/stock-events/lib/physical-inventory-form';
import { inventoryLineKey } from '@/features/stock-events/lib/physical-inventory-lines';
import type { InventoryLotBody } from '@/features/stock-events/lib/physical-inventory-lots';
import type {
  InventoryDraftItem,
  InventoryScope,
  InventoryStockLine,
  InventorySummary,
  PhysicalInventoryDraft,
} from '@/features/stock-events/lib/physical-inventory-types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { isOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

export async function fetchPhysicalInventoryDraft({
  programId,
  facilityId,
}: InventoryScope): Promise<PhysicalInventoryDraft | null> {
  const { data } = await client.get<PhysicalInventoryDraft[]>('/physicalInventories', {
    params: { program: programId, facility: facilityId, isDraft: true },
  });
  return data[0] ?? null;
}

export async function startPhysicalInventory(
  scope: InventoryScope,
): Promise<PhysicalInventoryDraft> {
  const { data } = await client.post<PhysicalInventoryDraft>('/physicalInventories', scope);
  return { ...data, lineItems: data.lineItems ?? [] };
}

export async function fetchInventorySummaries(scope: InventoryScope): Promise<InventorySummary[]> {
  const { data } = await client.get<Page<InventorySummary>>('/v2/stockCardSummaries', {
    params: scope,
  });
  return data.content;
}

async function fetchInventoryOrderables(
  ids: readonly string[],
  summaries: readonly InventorySummary[],
  lookup: typeof fetchOrderablesByIdentities,
) {
  const identities = summaries
    .flatMap((summary) => [
      summary.orderable,
      ...summary.canFulfillForMe.map((card) => card.orderable),
    ])
    .filter((item): item is OrderableIdentity => typeof item.versionNumber === 'number');
  const versioned = new Set(identities.map((item) => item.id));
  const [exact, remaining] = await Promise.all([
    lookup(identities),
    fetchOrderablesByIds(ids.filter((id) => !versioned.has(id))),
  ]);
  return [...exact, ...remaining];
}

export async function fetchInventoryStockLines(
  draft: readonly InventoryDraftItem[],
  summaries: readonly InventorySummary[],
  lookup = fetchOrderablesByIdentities,
): Promise<InventoryStockLine[]> {
  const session = getSessionScope();
  const cards = summaries.flatMap((summary) => summary.canFulfillForMe);
  const productIds = [
    ...new Set([
      ...cards.map((card) => card.orderable.id),
      ...draft.map((line) => line.orderableId),
    ]),
  ];
  const lotIds = [
    ...new Set(
      [...cards.map((card) => card.lot?.id), ...draft.map((line) => line.lotId)].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];
  const [products, lots] = await Promise.all([
    fetchInventoryOrderables(productIds, summaries, lookup),
    fetchLotsByIds(lotIds),
  ]);
  assertSessionScope(session);
  const productMap = new Map(products.map((product) => [product.id, product]));
  const lotMap = new Map(lots.map((lot) => [lot.id, lot]));
  const found = new Map<string, InventoryStockLine>();
  for (const card of cards) {
    const line = stockLineFromCard(card, productMap, lotMap);
    found.set(inventoryLineKey(line.orderable.id, line.lot?.id), line);
  }
  for (const item of draft) {
    const key = inventoryLineKey(item.orderableId, item.lotId);
    if (found.has(key)) continue;
    const orderable = productMap.get(item.orderableId);
    if (!orderable) throw new Error(`Missing product ${item.orderableId}`);
    const lot = item.lotId ? lotMap.get(item.lotId) : null;
    if (item.lotId && !lot) throw new Error(`Missing lot ${item.lotId}`);
    found.set(key, { orderable, lot: lot ?? null, stockOnHand: null });
  }
  return [...found.values()];
}

export async function fetchEligibleInventoryProducts(
  { facilityId, programId }: InventoryScope,
  summaries: readonly InventorySummary[],
  lookup = fetchOrderablesByIdentities,
): Promise<InventoryStockLine[]> {
  const session = getSessionScope();
  const approvedIds = summaries.map((summary) => summary.orderable.id);
  const knownIds = [
    ...new Set([
      ...approvedIds,
      ...summaries.flatMap((summary) => summary.canFulfillForMe.map((card) => card.orderable.id)),
    ]),
  ];
  const [scopeFulfills, knownProducts] = await Promise.all([
    approvedIds.length
      ? fetchFacilityOrderableFulfills({ facilityId, programId })
      : ({} as OrderableFulfills),
    fetchInventoryOrderables(knownIds, summaries, lookup),
  ]);
  assertSessionScope(session);
  const fulfills = Object.fromEntries(
    approvedIds.flatMap((id) => (scopeFulfills[id] ? [[id, scopeFulfills[id]]] : [])),
  );
  const ids = [
    ...new Set([
      ...approvedIds,
      ...Object.values(fulfills).flatMap((item) => item.canFulfillForMe ?? []),
      ...summaries.flatMap((summary) => summary.canFulfillForMe.map((card) => card.orderable.id)),
    ]),
  ];
  const known = new Set(knownIds);
  const remainingIds = ids.filter((id) => !known.has(id));
  if (!isOnline()) throw new LocalDataUnavailableError();
  const extraProducts = remainingIds.length ? await fetchOrderablesByIds(remainingIds) : [];
  assertSessionScope(session);
  const productMap = new Map(
    [...knownProducts, ...extraProducts].map((product) => [product.id, product]),
  );
  const products = ids.flatMap((id) => {
    const product = productMap.get(id);
    return product ? [product] : [];
  });
  const tradeItems = [
    ...new Set(
      products
        .map((product) => product.identifiers?.tradeItem)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (!isOnline()) throw new LocalDataUnavailableError();
  const lots = await fetchLotsByTradeItems(tradeItems);
  assertSessionScope(session);
  return buildEligibleProducts(summaries, fulfills, products, lots);
}

export async function deactivateInventoryStockCard(stockCardId: string) {
  await client.post(`/stockCards/${stockCardId}/deactivate`);
}

export async function createPhysicalInventoryLot(body: InventoryLotBody) {
  const { data } = await client.post<LotSummary>('/lots', body);
  return data;
}
export async function savePhysicalInventory(body: ReturnType<typeof inventorySavePayload>) {
  await client.put(`/physicalInventories/${body.id}`, body);
}
export async function deletePhysicalInventory(id: string) {
  await client.delete(`/physicalInventories/${id}`);
}
export async function submitPhysicalInventory(body: ReturnType<typeof inventorySubmitPayload>) {
  await client.post('/stockEvents', body);
}
export function fetchPhysicalInventoryReport(id: string, showInDoses: boolean, lang: string) {
  return fetchReport(`/physicalInventories/${id}`, { format: 'pdf', showInDoses, lang });
}
