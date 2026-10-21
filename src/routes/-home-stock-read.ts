import { readStockCardHistory } from '@/features/stock-card/lib/history-cache';
import { summaryStockCard } from '@/features/stock-card/lib/summary-stock-card';
import type { StockCard } from '@/features/stock-card/lib/types';
import {
  type HomeStockBundle,
  readHomeStockBundle,
} from '@/features/stock-events/lib/home-stock-bundle';
import { projectStockSummaries } from '@/features/stock-on-hand/lib/project-stock-summaries';
import type { StockCardSummariesQuery, StockOnHandPage } from '@/features/stock-on-hand/lib/types';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { readOfflineAccess } from '@/lib/offline-access';
import { homeStockScopes, isHomeStockScope } from '@/lib/stock-programs';

async function eligibleScope(facilityId: string, programId: string) {
  const access = await readOfflineAccess();
  const home = access.homeFacility;
  if (!home || !isHomeStockScope(access, facilityId, programId))
    throw new LocalDataUnavailableError();
  return { access, home };
}

async function downloadedScope(facilityId: string, programId: string) {
  const { access, home } = await eligibleScope(facilityId, programId);
  const bundle = await readHomeStockBundle({ facilityId, programId, facilityTypeId: home.type.id });
  return { bundle, access };
}

export async function readStockOnHandOnDevice(
  query: StockCardSummariesQuery,
): Promise<StockOnHandPage> {
  const { bundle } = await downloadedScope(query.facilityId, query.programId);
  if (!bundle.summaries || !bundle.products) throw new LocalDataUnavailableError();
  const { products, lots, ...page } = projectStockSummaries(
    bundle.summaries,
    bundle.products,
    bundle.cards.flatMap((card) => (card.lot ? [card.lot] : [])),
    query,
  );
  return {
    ...page,
    device: { products, lots, fetchedAt: bundle.fetchedAt, generation: bundle.generation },
  };
}

export async function readStockCardOnDevice(id: string): Promise<StockCard> {
  const history = await readStockCardHistory(id);
  if (history) {
    await eligibleScope(history.facility.id, history.program.id);
  }
  const access = await readOfflineAccess();
  const home = access.homeFacility;
  if (!home) throw new LocalDataUnavailableError();
  for (const task of homeStockScopes(access)) {
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
    return summaryStockCard(card, home, program, bundle, history);
  }
  if (history) return history;
  throw new LocalDataUnavailableError();
}
