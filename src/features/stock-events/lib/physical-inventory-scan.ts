import { quantityValue } from '@/components/form/quantity-value';
import { buildInventoryLines } from '@/features/stock-events/lib/physical-inventory-lines';
import { addedInventoryLine } from '@/features/stock-events/lib/physical-inventory-products';
import type {
  InventoryLine,
  InventoryStockLine,
} from '@/features/stock-events/lib/physical-inventory-types';
import type { ScanMessage } from '@/lib/scan-messages';
import { scanMessage } from '@/lib/scan-messages';
import type { StockScan } from '@/lib/stock-scan';
import { toOptionalWholeNumber } from '@/lib/whole-number';

export type InventoryScanPrompt =
  | { type: 'new-lot'; lotCode: string; expiryDate: string | null }
  | { type: 'expiry'; recorded: string; scanned: string };
export type InventoryScanResult =
  | { type: 'line'; line: InventoryLine }
  | { type: 'refuse'; message: ScanMessage }
  | { type: 'cancelled' };
export async function resolveInventoryScan({
  scan,
  tradeItemId,
  eligible,
  lines,
  canManageLots,
  acceptedExpiries,
  confirm,
  signal,
}: {
  scan: StockScan;
  tradeItemId: string;
  eligible: readonly InventoryStockLine[];
  lines: readonly InventoryLine[];
  canManageLots: boolean;
  acceptedExpiries: Set<string>;
  confirm: (prompt: InventoryScanPrompt) => Promise<boolean>;
  signal?: AbortSignal;
}): Promise<InventoryScanResult> {
  if (signal?.aborted) return { type: 'cancelled' };
  const matches = eligible.filter((item) => item.orderable.identifiers?.tradeItem === tradeItemId);
  const ids = new Set(matches.map((item) => item.orderable.id));
  if (!ids.size)
    return { type: 'refuse', message: scanMessage('productNotOnScreen', { gtin: scan.gtin }) };
  if (ids.size > 1)
    return { type: 'refuse', message: scanMessage('productAmbiguous', { gtin: scan.gtin }) };
  const sameLot = (lotCode: string | undefined) =>
    scan.lotCode ? lotCode?.toLowerCase() === scan.lotCode.toLowerCase() : !lotCode;
  let line = lines.find(
    (item) => ids.has(item.orderable.id) && sameLot(item.lot?.lotCode ?? item.newLot?.lotCode),
  );
  if (!line) {
    const stock = matches.find((item) => sameLot(item.lot?.lotCode));
    if (stock)
      line = buildInventoryLines(
        [stock],
        [{ orderableId: stock.orderable.id, lotId: stock.lot?.id, quantity: -1 }],
      )[0];
    else {
      if (!scan.lotCode) return { type: 'refuse', message: scanMessage('lotRequired') };
      if (!canManageLots)
        return {
          type: 'refuse',
          message: {
            key: 'physical-inventory.scan-no-lot-right',
            params: { lotCode: scan.lotCode },
          },
        };
      const expiryDate =
        scan.expiry instanceof Date
          ? scan.expiry.toISOString().slice(0, 10)
          : (scan.expiry ?? null);
      const accepted = await confirm({ type: 'new-lot', lotCode: scan.lotCode, expiryDate });
      if (signal?.aborted) return { type: 'cancelled' };
      if (!accepted) return { type: 'refuse', message: { key: 'scan.not-resolved' } };
      line = addedInventoryLine(matches[0], quantityValue(), {
        clientId: crypto.randomUUID(),
        lotCode: scan.lotCode,
        expirationDate: expiryDate,
        tradeItemId,
      });
    }
  }
  const recorded = line.lot?.expirationDate ?? line.newLot?.expirationDate;
  const scanned =
    scan.expiry instanceof Date ? scan.expiry.toISOString().slice(0, 10) : scan.expiry;
  const batch = `${tradeItemId}|${line.lot?.id ?? (line.newLot?.lotCode ?? scan.lotCode)?.toLowerCase()}`;
  if (recorded && scanned && recorded !== scanned && !acceptedExpiries.has(batch)) {
    const accepted = await confirm({ type: 'expiry', recorded, scanned });
    if (signal?.aborted) return { type: 'cancelled' };
    if (!accepted) return { type: 'refuse', message: { key: 'scan.not-resolved' } };
    acceptedExpiries.add(batch);
  }
  return signal?.aborted ? { type: 'cancelled' } : { type: 'line', line };
}
export function countInventoryScan(line: InventoryLine): InventoryLine {
  const pack =
    line.orderable.netContent && line.orderable.netContent > 0 ? line.orderable.netContent : 1;
  return {
    ...line,
    active: true,
    isAdded: true,
    quantity: quantityValue(
      String((toOptionalWholeNumber(line.quantity.doses) ?? 0) + pack),
      line.orderable.netContent,
    ),
  };
}
