import {
  fetchLotsByIds,
  fetchLotsByTradeItems,
  fetchOrderableFulfills,
  fetchOrderablesByIds,
} from '@/features/reference-data/api/api';
import { buildEligibleProducts } from '@/features/stock-events/lib/eligible-products';
import { inventoryLineKey } from '@/features/stock-events/lib/physical-inventory-lines';
import type {
  InventoryDraftItem,
  InventoryScope,
  InventoryStockLine,
  InventorySummary,
  PhysicalInventoryDraft,
} from '@/features/stock-events/lib/physical-inventory-types';
import { client } from '@/integrations/axios';
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

export async function fetchInventorySummaries(
  scope: InventoryScope,
  nonEmptyOnly = false,
): Promise<InventorySummary[]> {
  const { data } = await client.get<Page<InventorySummary>>('/v2/stockCardSummaries', {
    params: { ...scope, ...(nonEmptyOnly && { nonEmptyOnly: true }) },
  });
  return data.content;
}

export async function fetchInventoryStockLines(
  scope: InventoryScope,
  draft: readonly InventoryDraftItem[],
): Promise<InventoryStockLine[]> {
  const session = getSessionScope();
  const summaries = await fetchInventorySummaries(scope, true);
  assertSessionScope(session);
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
    fetchOrderablesByIds(productIds),
    fetchLotsByIds(lotIds),
  ]);
  assertSessionScope(session);
  const productMap = new Map(products.map((product) => [product.id, product]));
  const lotMap = new Map(lots.map((lot) => [lot.id, lot]));
  const found = new Map<string, InventoryStockLine>();
  for (const card of cards) {
    const orderable = productMap.get(card.orderable.id);
    if (!orderable) throw new Error(`Missing product ${card.orderable.id}`);
    const lot = card.lot ? lotMap.get(card.lot.id) : null;
    if (card.lot && !lot) throw new Error(`Missing lot ${card.lot.id}`);
    found.set(inventoryLineKey(orderable.id, lot?.id), {
      orderable,
      lot: lot ?? null,
      stockOnHand: card.stockOnHand,
      stockCardId: card.stockCard?.id ?? null,
      active: card.active,
    });
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
  scope: InventoryScope,
): Promise<InventoryStockLine[]> {
  const session = getSessionScope();
  const summaries = await fetchInventorySummaries(scope);
  assertSessionScope(session);
  const approvedIds = summaries.map((summary) => summary.orderable.id);
  const fulfills = await fetchOrderableFulfills(approvedIds);
  assertSessionScope(session);
  const ids = [
    ...new Set([
      ...approvedIds,
      ...Object.values(fulfills).flatMap((item) => item.canFulfillForMe ?? []),
      ...summaries.flatMap((summary) => summary.canFulfillForMe.map((card) => card.orderable.id)),
    ]),
  ];
  const products = await fetchOrderablesByIds(ids);
  assertSessionScope(session);
  const tradeItems = [
    ...new Set(
      products
        .map((product) => product.identifiers?.tradeItem)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const lots = await fetchLotsByTradeItems(tradeItems);
  assertSessionScope(session);
  return buildEligibleProducts(summaries, fulfills, products, lots);
}
