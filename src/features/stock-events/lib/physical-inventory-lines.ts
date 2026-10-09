import { quantityValue } from '@/components/form/quantity-value';
import type {
  InventoryCategoryBand,
  InventoryDraftItem,
  InventoryLine,
  InventoryProductGroup,
  InventoryStockLine,
} from '@/features/stock-events/lib/physical-inventory-types';

export const inventoryLineKey = (orderableId: string, lotId?: string | null, clientId?: string) =>
  `${orderableId}|${clientId ? `new:${clientId}` : lotId || 'none'}`;

export function isInventoryMember(line: InventoryLine) {
  return Boolean(
    line.stockCardId ||
      line.isAdded ||
      line.justAdded ||
      line.quantity.doses.trim() ||
      line.stockAdjustments.length,
  );
}

export function buildInventoryLines(
  stock: readonly InventoryStockLine[],
  server: readonly InventoryDraftItem[],
  local: readonly InventoryLine[] = [],
  eligible?: readonly InventoryStockLine[],
): InventoryLine[] {
  const saved = new Map(
    server.map((line) => [inventoryLineKey(line.orderableId, line.lotId), line]),
  );
  const lines = new Map<string, InventoryLine>();
  for (const card of stock) {
    const key = inventoryLineKey(card.orderable.id, card.lot?.id);
    const item = saved.get(key);
    const hasQuantity = item?.quantity !== null && item?.quantity !== undefined;
    lines.set(key, {
      ...card,
      key,
      quantity: quantityValue(
        hasQuantity && item.quantity !== -1 ? String(item.quantity) : '',
        card.orderable.netContent,
      ),
      stockAdjustments: item?.stockAdjustments ?? [],
      vvmStatus: item?.extraData?.vvmStatus ?? null,
      isAdded: hasQuantity || Boolean(item?.stockAdjustments?.length),
      justAdded: false,
    });
  }
  for (const line of local) {
    const current = lines.get(line.key);
    lines.set(line.key, {
      ...line,
      ...(current && {
        stockOnHand: current.stockOnHand,
        stockCardId: current.stockCardId,
        active: current.active,
        orderable: current.orderable,
      }),
    });
  }
  const allowed = eligible && new Set(eligible.map((line) => line.orderable.id));
  return [...lines.values()].filter(
    (line) => isInventoryMember(line) && (!allowed || allowed.has(line.orderable.id)),
  );
}

export function filterInventoryLines(
  lines: readonly InventoryLine[],
  { keyword = '', includeInactive = false }: { keyword?: string; includeInactive?: boolean },
  formatDate: (value: string) => string,
  noLotLabel = '',
): InventoryLine[] {
  const query = keyword.trim().toLowerCase();
  const hasLot = lines.some((line) => line.lot || line.newLot);
  return lines.filter((line) => {
    if (!includeInactive && !line.active && line.stockOnHand === 0) return false;
    const { orderable, lot } = line;
    const fields = [
      orderable.productCode,
      orderable.fullProductName,
      orderable.dispensable?.displayUnit,
      line.stockOnHand === null ? '' : String(line.stockOnHand),
      line.quantity.doses,
      lot?.lotCode ?? line.newLot?.lotCode ?? (hasLot ? noLotLabel : ''),
      lot?.expirationDate ? formatDate(lot.expirationDate) : '',
    ];
    return !query || fields.some((field) => field?.toLowerCase().includes(query));
  });
}

export function inventoryGroups(lines: readonly InventoryLine[]): InventoryProductGroup[] {
  const groups = new Map<string, InventoryProductGroup>();
  for (const line of [...lines].sort((a, b) =>
    a.orderable.productCode.localeCompare(b.orderable.productCode),
  )) {
    const group = groups.get(line.orderable.id) ?? { orderable: line.orderable, lines: [] };
    group.lines.push(line);
    groups.set(line.orderable.id, group);
  }
  for (const group of groups.values())
    group.lines.sort((a, b) => {
      const first = a.lot?.lotCode ?? a.newLot?.lotCode;
      const second = b.lot?.lotCode ?? b.newLot?.lotCode;
      if (!first) return second ? -1 : 0;
      if (!second) return 1;
      return first.localeCompare(second);
    });
  return [...groups.values()];
}

export function inventoryPage(
  lines: readonly InventoryLine[],
  programId: string,
  page = 1,
  size = 20,
) {
  const all = inventoryGroups(lines);
  const currentPage = Math.max(1, Math.min(page, Math.ceil(all.length / size)));
  const groups = all.slice((currentPage - 1) * size, currentPage * size);
  const bands = new Map<string, InventoryCategoryBand>();
  for (const group of groups) {
    const category =
      group.orderable.programs?.find((program) => program.programId === programId)
        ?.orderableCategoryDisplayName ?? '';
    const band = bands.get(category) ?? { category, groups: [] };
    band.groups.push(group);
    bands.set(category, band);
  }
  return { groups, bands: [...bands.values()], page: currentPage, total: all.length };
}

export function inventoryProgress(lines: readonly InventoryLine[]) {
  const groups = inventoryGroups(lines);
  return {
    count: groups.filter((group) =>
      group.lines.every((line) => Boolean(line.quantity.doses.trim())),
    ).length,
    total: groups.length,
  };
}
