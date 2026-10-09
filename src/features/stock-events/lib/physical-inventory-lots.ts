import { isAxiosError } from 'axios';
import type { LotSummary } from '@/features/reference-data/lib/types';
import { inventoryLineKey } from '@/features/stock-events/lib/physical-inventory-lines';
import type { InventoryLine } from '@/features/stock-events/lib/physical-inventory-types';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { settleFew } from '@/lib/settle-few';

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
    public cause: unknown,
  ) {
    super(codes.join(', '));
  }
}
export async function createInventoryLots(
  lines: readonly InventoryLine[],
  create: (body: InventoryLotBody) => Promise<LotSummary>,
  persist: (lines: InventoryLine[]) => Promise<void>,
) {
  const scope = getSessionScope();
  let current = [...lines];
  for (const line of lines.filter((item) => item.newLot && !item.lot?.id)) {
    const result = await settleFew([line], async (item) => {
      const pending = item.newLot;
      if (!pending) return;
      const lot = await create({
        lotCode: pending.lotCode,
        expirationDate: pending.expirationDate,
        tradeItemId: pending.tradeItemId,
        active: true,
      });
      assertSessionScope(scope);
      current = current.map((entry) =>
        entry.key === item.key
          ? {
              ...entry,
              lot,
              key: inventoryLineKey(entry.orderable.id, lot.id),
              newLot: undefined,
            }
          : entry,
      );
      await persist(current);
      assertSessionScope(scope);
    });
    assertSessionScope(scope);
    if (result.failed.length) {
      const key = isAxiosError(result.error) ? result.error.response?.data?.messageKey : '';
      throw new InventoryLotError(
        result.failed.map((item) => item.newLot?.lotCode ?? ''),
        key?.endsWith('lotCode.mustBeUnique')
          ? 'duplicate'
          : key?.endsWith('tradeItem.required')
            ? 'trade-item'
            : 'other',
        result.error,
      );
    }
  }
  return current;
}
