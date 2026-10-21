import type { StockCard } from '@/features/stock-card/lib/types';
import { getLocalDbUserId, LOCAL_TABLES } from '@/integrations/local-db';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { putOwnedRecord, readOwnedRecord } from '@/lib/local-records';
import { readOfflineAccess } from '@/lib/offline-access';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { type HomeStockAccess, isHomeStockScope } from '@/lib/stock-programs';

type SavedStockCard = {
  id: string;
  userId: string;
  card: StockCard;
  fetchedAt: number;
  formatVersion: 1;
};

export async function saveStockCardHistory(card: StockCard, verifiedAccess?: HomeStockAccess) {
  const scope = getSessionScope();
  let access: HomeStockAccess;
  try {
    access = verifiedAccess ?? (await readOfflineAccess());
  } catch (error) {
    if (error instanceof LocalDataUnavailableError) return;
    throw error;
  }
  assertSessionScope(scope);
  if (!isHomeStockScope(access, card.facility.id, card.program.id)) return;
  await putOwnedRecord(LOCAL_TABLES.stockCardHistory, {
    id: card.id,
    userId: getLocalDbUserId(),
    card,
    fetchedAt: Date.now(),
    formatVersion: 1,
  });
  assertSessionScope(scope);
}

export async function readStockCardHistory(id: string): Promise<StockCard | undefined> {
  const saved = await readOwnedRecord<SavedStockCard>(LOCAL_TABLES.stockCardHistory, id, {
    formats: [1],
    accept: (record) => record.card.id === id,
  });
  if (!saved) return undefined;
  return {
    ...saved.card,
    summaryOnly: false,
    device: { fetchedAt: saved.fetchedAt, generation: `history:${saved.fetchedAt}` },
  };
}
