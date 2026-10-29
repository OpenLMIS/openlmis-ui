import type { StockCard } from '@/features/stock-card/lib/types';
import type { HomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { offlineAccessFixture } from '@/test-utils/offline-access';

export async function seedHomeStock(card: StockCard, userId: string) {
  const program = { ...card.program, active: true };
  const access = offlineAccessFixture({
    userId,
    home: card.facility,
    programs: [program],
    rights: [
      `STOCK_ADJUST|${card.facility.id}|${program.id}`,
      `STOCK_CARDS_VIEW|${card.facility.id}|${program.id}`,
    ],
  });
  const product = { ...card.orderable, description: null };
  const bundle: HomeStockBundle = {
    userId,
    facilityId: card.facility.id,
    programId: program.id,
    facilityTypeId: 'type',
    scanning: false,
    fetchedAt: Date.now(),
    generation: 'stock',
    formatVersion: 5,
    products: [product],
    cards: [
      {
        id: card.id,
        orderable: product,
        lot: card.lot,
        stockOnHand: card.stockOnHand,
        active: card.active,
        occurredDate: '2026-01-01',
      },
    ],
    summaries: [
      {
        orderable: { id: product.id },
        stockOnHand: card.stockOnHand,
        canFulfillForMe: [
          {
            stockCard: { id: card.id },
            orderable: { id: product.id },
            lot: card.lot,
            stockOnHand: card.stockOnHand,
            active: card.active,
            occurredDate: '2026-01-01',
          },
        ],
      },
    ],
    reasons: [],
    tradeItems: [],
    identities: [],
  };
  await getLocalDb().table(LOCAL_TABLES.offlineAccess).put(access);
  await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).put(bundle);
}
