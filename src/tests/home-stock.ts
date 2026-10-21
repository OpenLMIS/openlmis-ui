import type { StockCard } from '@/features/stock-card/lib/types';
import type { HomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import { getLocalDb } from '@/integrations/local-db';
import type { OfflineAccess } from '@/lib/offline-access';

export async function seedHomeStock(card: StockCard, userId: string) {
  const program = { ...card.program, active: true };
  const access: OfflineAccess = {
    userId,
    permissionStrings: [
      `STOCK_ADJUST|${card.facility.id}|${program.id}`,
      `STOCK_CARDS_VIEW|${card.facility.id}|${program.id}`,
    ],
    user: {
      id: userId,
      username: 'user',
      firstName: '',
      lastName: '',
      active: true,
      homeFacilityId: card.facility.id,
      roleAssignments: [],
    },
    programs: [program],
    homeFacility: {
      ...card.facility,
      active: true,
      enabled: true,
      type: { id: 'type', code: 'T', name: 'Type' },
      geographicZone: { id: 'zone', code: 'Z', name: 'Zone', level: { name: 'District' } },
      supportedPrograms: [{ ...program, supportActive: true, supportLocallyFulfilled: true }],
    },
    fetchedAt: Date.now(),
    generation: 'access',
    formatVersion: 1,
  };
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
  await getLocalDb().table('offlineAccess').put(access);
  await getLocalDb().table('homeStockDownloads').put(bundle);
}
