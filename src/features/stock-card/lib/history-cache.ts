import type { StockCard } from '@/features/stock-card/lib/types';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { type OfflineAccess, readOfflineAccess } from '@/lib/offline-access';
import { parsePermissions, programGrants } from '@/lib/permissions';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { homeStockPrograms } from '@/lib/stock-programs';

type SavedStockCard = {
  id: string;
  userId: string;
  card: StockCard;
  fetchedAt: number;
  formatVersion: 1;
};

export async function saveStockCardHistory(card: StockCard) {
  const scope = getSessionScope();
  let access: OfflineAccess;
  try {
    access = await readOfflineAccess();
  } catch (error) {
    if (error instanceof LocalDataUnavailableError) return;
    throw error;
  }
  assertSessionScope(scope);
  if (
    card.facility.id !== access.homeFacility?.id ||
    !homeStockPrograms({
      homeFacility: access.homeFacility,
      programs: access.programs,
      grants: programGrants(parsePermissions(access.permissionStrings), 'STOCK_CARDS_VIEW'),
    }).some((program) => program.id === card.program.id)
  )
    return;
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
