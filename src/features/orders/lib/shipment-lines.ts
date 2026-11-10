import {
  availableShipmentPacks,
  invalidShipmentPackSize,
} from '@/features/orders/lib/shipment-quantities';
import type { ShipmentSavedLine, ShipmentSummary } from '@/features/orders/lib/shipment-types';
import type { Order, OrderProduct } from '@/features/orders/lib/types';
import { MAX_WHOLE_NUMBER, toLatinDigits } from '@/lib/whole-number';

export type ShipmentLot = { id: string; lotCode?: string; expirationDate?: string | null };
export type ShipmentLine = {
  key: string;
  id?: string;
  orderedProductId: string;
  orderedProductIds?: readonly string[];
  product: OrderProduct;
  lot: ShipmentLot | null;
  stockCardId?: string;
  stockOnHand: number;
  fill: number | null;
  vvmStatus?: string | null;
};
export const shipmentLineKey = (productId: string, lotId?: string | null) =>
  JSON.stringify([productId, lotId ?? null]);

export function buildShipmentLines({
  orderLines,
  summaries,
  products,
  lots = [],
  savedLines = [],
  readOnly = false,
  vvm = {},
}: {
  orderLines: Order['orderLineItems'];
  summaries: readonly ShipmentSummary[];
  products: readonly OrderProduct[];
  lots?: readonly ShipmentLot[];
  savedLines?: readonly ShipmentSavedLine[];
  readOnly?: boolean;
  vvm?: Readonly<Record<string, string | null>>;
}): ShipmentLine[] {
  const stock = new Map<string, ShipmentLine>();
  for (const summary of summaries) {
    for (const card of summary.canFulfillForMe ?? []) {
      const key = shipmentLineKey(card.orderable.id, card.lot?.id);
      const product = products
        .filter((item) => item.id === card.orderable.id)
        .toSorted((a, b) => (b.meta?.versionNumber ?? 0) - (a.meta?.versionNumber ?? 0))[0] ?? {
        id: card.orderable.id,
      };
      const previous = stock.get(key);
      if (previous) {
        previous.orderedProductIds = [
          ...new Set([
            ...(previous.orderedProductIds ?? [previous.orderedProductId]),
            summary.orderable.id,
          ]),
        ];
      } else
        stock.set(key, {
          key,
          orderedProductId: summary.orderable.id,
          product,
          lot: lots.find((lot) => lot.id === card.lot?.id) ?? card.lot ?? null,
          stockCardId: card.stockCard.id,
          stockOnHand: card.stockOnHand ?? 0,
          fill: 0,
          vvmStatus: vvm[card.stockCard.id] ?? null,
        });
    }
  }
  const result = readOnly ? new Map<string, ShipmentLine>() : new Map(stock);
  for (const saved of savedLines) {
    const key = shipmentLineKey(saved.orderable.id, saved.lot?.id);
    const current = stock.get(key);
    const product = products.find(
      (item) =>
        item.id === saved.orderable.id &&
        item.meta?.versionNumber === saved.orderable.versionNumber,
    ) ??
      products.find((item) => item.id === saved.orderable.id) ??
      orderLines.find((line) => line.orderable.id === saved.orderable.id)?.orderable ?? {
        id: saved.orderable.id,
      };
    const orderedProductId =
      current?.orderedProductId ??
      [...stock.values()].find((line) => line.product.id === product.id)?.orderedProductId ??
      product.id;
    result.set(key, {
      ...current,
      key,
      id: saved.id,
      orderedProductId,
      product: {
        ...product,
        meta: { ...product.meta, versionNumber: saved.orderable.versionNumber },
      },
      lot: lots.find((lot) => lot.id === saved.lot?.id) ?? saved.lot,
      stockOnHand: current?.stockOnHand ?? 0,
      fill: saved.quantityShipped,
    });
  }
  return [...result.values()];
}

export function compareShipmentLots(a: ShipmentLine, b: ShipmentLine) {
  return (
    Number(!!a.lot) - Number(!!b.lot) ||
    (b.vvmStatus ?? 'STAGE_1').localeCompare(a.vvmStatus ?? 'STAGE_1') ||
    (a.lot?.expirationDate ?? '').localeCompare(b.lot?.expirationDate ?? '') ||
    availableShipmentPacks(a.stockOnHand, a.product.netContent) -
      availableShipmentPacks(b.stockOnHand, b.product.netContent)
  );
}
export type ShipmentGroup = {
  kind: 'single' | 'product' | 'subgroup';
  product: OrderProduct;
  orderedQuantity?: number | null;
  lines: ShipmentLine[];
  noStock: boolean;
  children: ShipmentGroup[];
};
const noStock = (lines: readonly ShipmentLine[]) =>
  lines.reduce(
    (sum, line) => sum + availableShipmentPacks(line.stockOnHand, line.product.netContent),
    0,
  ) === 0;

export function shipmentGroups(
  orderLines: Order['orderLineItems'],
  lines: readonly ShipmentLine[],
  retained?: ReadonlySet<string>,
): ShipmentGroup[] {
  const ordered = [...orderLines];
  for (const line of lines) {
    if (!ordered.some((item) => item.orderable.id === line.orderedProductId))
      ordered.push({ orderable: line.product, orderedQuantity: null });
  }
  return ordered.map((order): ShipmentGroup => {
    const items = lines.filter((line) =>
      (line.orderedProductIds ?? [line.orderedProductId]).includes(order.orderable.id),
    );
    const single =
      items.length === 1 && items[0].product.id === order.orderable.id && !items[0].lot;
    const empty = noStock(items);
    const visible = empty
      ? items.filter((line) => (retained ? retained.has(line.key) : (line.fill ?? 0) > 0))
      : items;
    const ids = [...new Set(visible.map((line) => line.product.id))];
    return {
      kind: single ? 'single' : 'product',
      product: order.orderable,
      orderedQuantity: order.orderedQuantity,
      lines: items,
      noStock: !single && empty,
      children: single
        ? []
        : ids.map((id) => {
            const all = items.filter((line) => line.product.id === id);
            const children = visible
              .filter((line) => line.product.id === id)
              .toSorted(compareShipmentLots);
            return {
              kind: all.length > 1 ? 'subgroup' : 'single',
              product: children[0].product,
              lines: children,
              noStock: all.length > 1 && noStock(all),
              children: [],
            };
          }),
    };
  });
}

export function validateShipmentFill(line: ShipmentLine, fill: string | number | null) {
  const text = toLatinDigits(String(fill ?? '').trim());
  if (!text) return 'orders.shipment.fill-required';
  if (!/^\d+$/.test(text)) return 'orders.shipment.fill-whole-number';
  if (Number(text) > MAX_WHOLE_NUMBER) return 'orders.shipment.fill-too-large';
  const value = Number(text);
  if (invalidShipmentPackSize(line.product.netContent, value))
    return 'orders.shipment.invalid-pack-size';
  if (value > availableShipmentPacks(line.stockOnHand, line.product.netContent))
    return 'orders.shipment.fill-exceeds-stock';
  return null;
}
