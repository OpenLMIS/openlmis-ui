import type { StockCard } from '@/features/stock-card/lib/types';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

type SavedStockCard = {
  id: string;
  userId: string;
  card: StockCard;
  fetchedAt: number;
  formatVersion: 1;
};

const HISTORY_LIMIT = 50;

export async function saveStockCardHistory(card: StockCard) {
  const scope = getSessionScope();
  const fetchedAt = Date.now();
  const { getLocalDb, getLocalDbUserId } = await import('@/integrations/local-db');
  assertSessionScope(scope);
  const userId = getLocalDbUserId();
  const db = getLocalDb();
  const table = db.table<SavedStockCard>('stockCardHistory');
  await db.transaction('rw', table, async () => {
    assertSessionScope(scope);
    await table.put({ id: card.id, userId, card, fetchedAt, formatVersion: 1 });
    assertSessionScope(scope);
    const obsolete = await table.orderBy('fetchedAt').reverse().offset(HISTORY_LIMIT).primaryKeys();
    assertSessionScope(scope);
    await table.bulkDelete(obsolete);
    assertSessionScope(scope);
  });
  assertSessionScope(scope);
}

export async function readStockCardHistory(id: string): Promise<StockCard | undefined> {
  const scope = getSessionScope();
  const { getLocalDb, getLocalDbUserId } = await import('@/integrations/local-db');
  assertSessionScope(scope);
  const userId = getLocalDbUserId();
  const saved = await getLocalDb().table<SavedStockCard>('stockCardHistory').get(id);
  assertSessionScope(scope);
  if (!saved || saved.userId !== userId || saved.formatVersion !== 1 || saved.card.id !== id)
    return undefined;
  return { ...saved.card, summaryOnly: false, downloadedAt: saved.fetchedAt };
}
