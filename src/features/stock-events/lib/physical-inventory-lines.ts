import { quantityValue } from '@/components/form/quantity-value';
import { productName } from '@/features/reference-data/lib/product-name';
import { pageOf } from '@/features/stock-events/lib/line-filter';
import type { InventoryLocalCopy } from '@/features/stock-events/lib/physical-inventory-local';
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
  local?: readonly InventoryLine[],
  removedKeys: readonly string[] = [],
): InventoryLine[] {
  const saved = new Map(
    (local ? [] : server).map((line) => [inventoryLineKey(line.orderableId, line.lotId), line]),
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
  for (const line of local ?? []) {
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
  for (const key of removedKeys) lines.delete(key);
  return [...lines.values()].filter(isInventoryMember);
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
    if (!query) return true;
    const { orderable } = line;
    const fields = [
      orderable.productCode,
      orderable.dispensable?.displayUnit
        ? `${productName(orderable)} - ${orderable.dispensable.displayUnit}`
        : productName(orderable),
      line.stockOnHand === null ? '' : String(line.stockOnHand),
      line.quantity.doses,
      inventoryLotCode(line) ?? (hasLot ? noLotLabel : ''),
      inventoryExpiry(line) ? formatDate(inventoryExpiry(line) ?? '') : '',
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
      const first = inventoryLotCode(a);
      const second = inventoryLotCode(b);
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
  size = INVENTORY_PAGE_SIZE,
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
  const groups = new Map<string, boolean>();
  for (const line of lines)
    groups.set(
      line.orderable.id,
      (groups.get(line.orderable.id) ?? true) && Boolean(line.quantity.doses.trim()),
    );
  return { count: [...groups.values()].filter(Boolean).length, total: groups.size };
}

export const INVENTORY_PAGE_SIZE = 20;
export const inventoryLotCode = (line: InventoryLine) => line.lot?.lotCode ?? line.newLot?.lotCode;
export const inventoryExpiry = (line: InventoryLine) =>
  line.lot?.expirationDate ?? line.newLot?.expirationDate;
export function eligibleInventoryLines(
  lines: readonly InventoryLine[],
  eligible?: readonly InventoryStockLine[],
) {
  if (!eligible) return [...lines];
  const allowed = new Set(eligible.map((line) => line.orderable.id));
  return lines.filter((line) => allowed.has(line.orderable.id));
}
export function inventoryPageOf(
  lines: readonly InventoryLine[],
  line: InventoryLine,
  size = INVENTORY_PAGE_SIZE,
) {
  return pageOf(
    inventoryGroups(lines).findIndex((group) => group.orderable.id === line.orderable.id),
    size,
  );
}
export function inventoryLocalCopy(
  draft: { id: string; programId: string; facilityId: string },
  lines: readonly InventoryLine[],
  baseline?: readonly InventoryLine[],
): InventoryLocalCopy {
  const keys = new Set(lines.map((line) => line.key));
  return {
    draftId: draft.id,
    programId: draft.programId,
    facilityId: draft.facilityId,
    lines: [...lines],
    removedKeys: baseline?.filter((line) => !keys.has(line.key)).map((line) => line.key) ?? [],
    modified: true,
    savedAt: Date.now(),
  };
}

export function inventoryFirstInvalid(
  lines: readonly InventoryLine[],
  invalid: readonly InventoryLine[],
  programId: string,
  includeInactive: boolean,
  size = INVENTORY_PAGE_SIZE,
) {
  const keys = new Set(invalid.map((line) => line.key));
  const visible = filterInventoryLines(lines, { includeInactive }, String);
  const total = inventoryGroups(visible).length;
  for (let page = 1; page <= Math.ceil(total / size); page++) {
    const first = inventoryPage(visible, programId, page, size)
      .bands.flatMap((band) => band.groups.flatMap((group) => group.lines))
      .find((line) => keys.has(line.key));
    if (first) return first;
  }
}

export function inventoryStructureEqual(a: readonly InventoryLine[], b: readonly InventoryLine[]) {
  return (
    a.length === b.length &&
    a.every((line, index) => {
      const next = b[index];
      return (
        line.key === next.key &&
        line.orderable === next.orderable &&
        line.lot === next.lot &&
        line.newLot === next.newLot &&
        line.stockOnHand === next.stockOnHand &&
        line.stockCardId === next.stockCardId &&
        line.active === next.active &&
        line.isAdded === next.isAdded &&
        line.justAdded === next.justAdded
      );
    })
  );
}
