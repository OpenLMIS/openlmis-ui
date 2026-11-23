import type { LotSummary } from '@/features/reference-data/lib/types';
import { inventoryLineKey } from '@/features/stock-events/lib/physical-inventory-lines';
import type { InventoryLine } from '@/features/stock-events/lib/physical-inventory-types';
import { isSilentApiError, serverMessageKey } from '@/lib/api-error';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export type InventoryLotBody = {
  lotCode: string;
  expirationDate: string | null;
  tradeItemId: string;
  active: true;
};
export class InventoryLotError extends Error {
  constructor(
    public codes: string[],
    public reason: 'duplicate' | 'trade-item' | 'other',
    public cause?: unknown,
  ) {
    super(codes.join(', '));
  }
}
const isDuplicateLot = (error: unknown) =>
  serverMessageKey(error)?.endsWith('lotCode.mustBeUnique');

export async function createInventoryLots(
  lines: readonly InventoryLine[],
  lookup: (
    tradeItemId: string,
    lotCode: string,
    expirationDate: string | null,
  ) => Promise<LotSummary | undefined>,
  create: (body: InventoryLotBody) => Promise<LotSummary>,
  persist: (lines: InventoryLine[]) => Promise<void>,
) {
  const scope = getSessionScope();
  let current = [...lines];
  for (const line of lines.filter((item) => item.newLot && !item.lot?.id)) {
    assertSessionScope(scope);
    try {
      const pending = line.newLot;
      if (!pending) continue;
      const { lotCode, expirationDate, tradeItemId } = pending;
      let lot = await lookup(tradeItemId, lotCode, expirationDate);
      assertSessionScope(scope);
      if (!lot) {
        try {
          lot = await create({ lotCode, expirationDate, tradeItemId, active: true });
        } catch (error) {
          assertSessionScope(scope);
          if (!isDuplicateLot(error)) throw error;
          try {
            lot = await lookup(tradeItemId, lotCode, expirationDate);
          } catch (lookupError) {
            if (isSilentApiError(lookupError)) throw lookupError;
          }
          assertSessionScope(scope);
          if (!lot) throw error;
        }
      }
      assertSessionScope(scope);
      const key = inventoryLineKey(line.orderable.id, lot.id);
      const existing = current.find((entry) => entry.key === key);
      if (existing) {
        if (
          existing.quantity.doses.trim() ||
          existing.stockAdjustments.length ||
          existing.vvmStatus
        )
          throw new InventoryLotError([lotCode], 'duplicate');

        current = current
          .filter((entry) => entry.key !== line.key)
          .map((entry) =>
            entry === existing
              ? {
                  ...entry,
                  quantity: line.quantity,
                  stockAdjustments: line.stockAdjustments,
                  vvmStatus: line.vvmStatus,
                  isAdded: entry.isAdded || line.isAdded,
                }
              : entry,
          );
      } else {
        current = current.map((entry) =>
          entry.key === line.key ? { ...entry, lot, key, newLot: undefined } : entry,
        );
      }
      await persist(current);
      assertSessionScope(scope);
    } catch (error) {
      assertSessionScope(scope);
      if (
        error instanceof InventoryLotError ||
        (error instanceof Error && error.name === 'SessionEndedError')
      )
        throw error;
      const key = serverMessageKey(error);
      throw new InventoryLotError(
        [line.newLot?.lotCode ?? ''],
        isDuplicateLot(error)
          ? 'duplicate'
          : key?.endsWith('tradeItem.required')
            ? 'trade-item'
            : 'other',
        error,
      );
    }
  }
  return current;
}
