import { latestOrderableVersions } from '@/features/reference-data/lib/latest-orderable-versions';
import type { StockCard } from '@/features/stock-card/lib/types';
import {
  type HomeStockBundle,
  readHomeStockBundle,
} from '@/features/stock-events/lib/home-stock-bundle';
import { homeStockProvider } from '@/features/stock-events/lib/home-stock-provider';
import type { StockCardSummariesQuery, StockOnHandPage } from '@/features/stock-on-hand/lib/types';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { readOfflineAccess } from '@/lib/offline-access';

async function downloadedScope(facilityId: string, programId: string) {
  const access = await readOfflineAccess();
  const task = homeStockProvider()
    .tasks(access)
    .find((task) => task.id === programId && access.homeFacility?.id === facilityId);
  const home = access.homeFacility;
  if (!task || !home) throw new LocalDataUnavailableError();
  const bundle = await readHomeStockBundle({ facilityId, programId, facilityTypeId: home.type.id });
  return { bundle, access };
}

export async function readStockOnHandOnDevice(
  query: StockCardSummariesQuery,
): Promise<StockOnHandPage> {
  const { bundle } = await downloadedScope(query.facilityId, query.programId);
  const latestProducts = latestOrderableVersions(bundle.products);
  const products = new Map(latestProducts.map((product) => [product.id, product]));
  const lots = bundle.cards.flatMap((card) => (card.lot ? [card.lot] : []));
  const byLot = new Map(lots.map((lot) => [lot.id, lot]));
  const matches = (value: string | null | undefined, filter: string | undefined) =>
    !filter || (value ?? '').toLocaleLowerCase().includes(filter.toLocaleLowerCase());
  const summaries = bundle.summaries.flatMap((summary) => {
    const product = products.get(summary.orderable.id);
    if (
      !matches(product?.fullProductName, query.orderableName) ||
      !matches(product?.productCode, query.orderableCode)
    )
      return [];
    const entries = summary.canFulfillForMe.filter((entry) =>
      matches(entry.lot ? byLot.get(entry.lot.id)?.lotCode : undefined, query.lotCode),
    );
    return entries.length ? [{ ...summary, canFulfillForMe: entries }] : [];
  });
  return {
    content: summaries.slice(query.page * query.size, (query.page + 1) * query.size),
    totalElements: summaries.length,
    totalPages: Math.ceil(summaries.length / query.size),
    number: query.page,
    size: query.size,
    device: {
      products: latestProducts,
      lots,
      fetchedAt: bundle.fetchedAt,
      generation: bundle.generation,
    },
  };
}

export async function readStockCardOnDevice(id: string): Promise<StockCard> {
  const access = await readOfflineAccess();
  const home = access.homeFacility;
  if (!home) throw new LocalDataUnavailableError();
  for (const task of homeStockProvider().tasks(access)) {
    let bundle: HomeStockBundle;
    try {
      bundle = await readHomeStockBundle({
        facilityId: home.id,
        programId: task.id,
        facilityTypeId: home.type.id,
      });
    } catch (error) {
      if (error instanceof LocalDataUnavailableError) continue;
      throw error;
    }
    const card = bundle.cards.find((card) => card.id === id);
    if (!card) continue;
    const program = access.programs.find((program) => program.id === bundle.programId);
    if (!program) throw new LocalDataUnavailableError();
    return {
      id: card.id,
      facility: { ...home, name: home.name ?? home.code },
      program: { ...program, name: program.name ?? program.code },
      orderable: {
        ...card.orderable,
        fullProductName: card.orderable.fullProductName ?? card.orderable.productCode,
      },
      lot: card.lot,
      stockOnHand: card.stockOnHand,
      active: card.active,
      lineItems: [],
      summaryOnly: true,
      downloadedAt: bundle.fetchedAt,
    };
  }
  throw new LocalDataUnavailableError();
}
