import type { AxiosRequestConfig } from 'axios';
import {
  fetchAllOrderableVersions,
  fetchFacilityOrderableFulfills,
  fetchLotsByTradeItems,
  fetchOrderablesByIds,
  fetchProgramOrderables,
  fetchTradeItemsByIds,
} from '@/features/reference-data/api/api';
import type { LotSummary, Orderable, TradeItem } from '@/features/reference-data/lib/types';
import { fetchApprovedSummaries } from '@/features/stock-events/api/stock-card-reader';
import { downloadReader } from '@/features/stock-events/lib/download-read';
import { getLocalDbUserId, LOCAL_TABLES } from '@/integrations/local-db';
import { requireOwnedRecord } from '@/lib/local-records';
import { randomId } from '@/lib/random-id';
import { getSessionScope } from '@/lib/session-scope';

export const RECEIVE_CATALOG_FORMAT = 1;
export type ReceiveCatalogFilter = {
  facilityId: string;
  programId: string;
  facilityTypeId: string;
};
export type ReceiveCatalogScope = ReceiveCatalogFilter & { programCode: string; scanning: boolean };
export type ReceiveCatalog = ReceiveCatalogFilter & {
  userId: string;
  generation: string;
  fetchedAt: number;
  stale?: boolean;
  formatVersion: typeof RECEIVE_CATALOG_FORMAT;
  scanning: boolean;
  approved: { id: string; versionNumber: number | null }[];
  products: Orderable[];
  fulfils: Record<string, string[]>;
  lots: LotSummary[];
  tradeItems: TradeItem[];
};

function catalogProduct(product: Orderable): Orderable {
  return {
    id: product.id,
    productCode: product.productCode,
    fullProductName: product.fullProductName,
    description: null,
    netContent: product.netContent,
    dispensable: product.dispensable ? { displayUnit: product.dispensable.displayUnit } : undefined,
    identifiers: product.identifiers ? { tradeItem: product.identifiers.tradeItem } : undefined,
    extraData: product.extraData ? { useVVM: product.extraData.useVVM } : undefined,
    meta: product.meta ? { versionNumber: product.meta.versionNumber } : undefined,
  };
}

export async function fetchReceiveCatalog(
  scope: ReceiveCatalogScope,
  signal?: AbortSignal,
): Promise<ReceiveCatalog> {
  const userId = getLocalDbUserId();
  const config: AxiosRequestConfig & { signal?: AbortSignal } = {
    session: false,
    backgroundRead: true,
    signal,
    sessionScope: getSessionScope(),
  };
  const { check, read } = downloadReader(config);
  const filter = { facilityId: scope.facilityId, programId: scope.programId };
  const [approved, mapping, programProducts] = await Promise.all([
    read(() => fetchApprovedSummaries(filter, config)),
    read(() => fetchFacilityOrderableFulfills(filter, config)),
    read(() => fetchProgramOrderables(scope.programCode, config)),
  ]);
  check();
  const latest = new Map<string, Orderable>();
  const versions = new Map<string, Orderable>();
  const add = (product: Orderable) => {
    versions.set(`${product.id}|${product.meta?.versionNumber}`, product);
    if (
      !latest.has(product.id) ||
      (product.meta?.versionNumber ?? -1) > (latest.get(product.id)?.meta?.versionNumber ?? -1)
    )
      latest.set(product.id, product);
  };
  programProducts.forEach(add);
  const backfill = approved.flatMap(({ id, versionNumber }) =>
    versionNumber !== undefined && !versions.has(`${id}|${versionNumber}`)
      ? [{ id, versionNumber }]
      : [],
  );
  (await read(() => fetchAllOrderableVersions(backfill, config))).forEach(add);
  check();
  const fulfils = Object.fromEntries(
    approved.flatMap(({ id }) =>
      mapping[id]?.canFulfillForMe?.length ? [[id, [...new Set(mapping[id].canFulfillForMe)]]] : [],
    ),
  );
  const fulfillerIds = [...new Set(Object.values(fulfils).flat())];
  (
    await read(() =>
      fetchOrderablesByIds(
        [
          ...new Set([
            ...fulfillerIds,
            ...approved.flatMap(({ id, versionNumber }) =>
              versionNumber === undefined ? [id] : [],
            ),
          ]),
        ].filter((id) => !latest.has(id)),
        config,
      ),
    )
  ).forEach(add);
  check();
  const products = new Map<string, Orderable>();
  for (const id of fulfillerIds) {
    const product = latest.get(id);
    if (product) products.set(id, product);
  }
  for (const { id, versionNumber } of approved) {
    const product =
      versionNumber === undefined ? latest.get(id) : versions.get(`${id}|${versionNumber}`);
    if (!product) throw new Error('Receive catalog product not found');
    products.set(id, product);
  }
  const tradeIds = [
    ...new Set(
      [...products.values()].flatMap((product) =>
        product.identifiers?.tradeItem ? [product.identifiers.tradeItem] : [],
      ),
    ),
  ];
  const lots = await read(() => fetchLotsByTradeItems(tradeIds, config));
  const tradeItems = scope.scanning ? await read(() => fetchTradeItemsByIds(tradeIds, config)) : [];
  check();
  return {
    ...filter,
    facilityTypeId: scope.facilityTypeId,
    userId,
    generation: randomId(),
    fetchedAt: Date.now(),
    formatVersion: RECEIVE_CATALOG_FORMAT,
    scanning: scope.scanning,
    approved: approved.map(({ id, versionNumber }) => ({
      id,
      versionNumber: versionNumber ?? null,
    })),
    products: [...products.values()].map(catalogProduct),
    fulfils: Object.fromEntries(
      Object.entries(fulfils).map(([id, ids]) => [id, ids.filter((id) => products.has(id))]),
    ),
    lots: lots.map(({ id, lotCode, expirationDate, tradeItemId }) => ({
      id,
      lotCode,
      expirationDate,
      tradeItemId,
    })),
    tradeItems: tradeItems.filter((item) => item.gtin).map(({ id, gtin }) => ({ id, gtin })),
  };
}

export function readReceiveCatalog(filter: ReceiveCatalogFilter): Promise<ReceiveCatalog> {
  return requireOwnedRecord<ReceiveCatalog>(
    LOCAL_TABLES.receiveCatalogDownloads,
    [filter.facilityId, filter.programId],
    {
      formats: [RECEIVE_CATALOG_FORMAT],
      accept: (record) =>
        record.facilityId === filter.facilityId &&
        record.programId === filter.programId &&
        record.facilityTypeId === filter.facilityTypeId,
    },
  );
}
