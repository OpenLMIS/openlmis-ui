import type { PodLine, PodOrderLine, PodShipmentLine } from '@/features/orders/lib/pod-types';
import type { OrderProduct } from '@/features/orders/lib/types';
import type { OrderableFulfills } from '@/features/reference-data/lib/types';
export type PodGridLine = PodLine & { quantityShipped: number | null };
export type PodProductGroup = { product: OrderProduct; collapsed: boolean; lines: PodGridLine[] };
export type PodLineGroup = { orderLine: PodOrderLine | null; products: PodProductGroup[] };
export function shippedQuantity(line: PodLine, shipmentLines: readonly PodShipmentLine[]) {
  return (
    shipmentLines.find(
      (item) =>
        item.orderable.id === line.orderable.id &&
        (item.lot?.id ?? null) === (line.lot?.id ?? null),
    )?.quantityShipped ?? null
  );
}
export function groupPodLines(
  orderLines: readonly PodOrderLine[],
  lines: readonly PodLine[],
  shipmentLines: readonly PodShipmentLine[],
  fulfills: OrderableFulfills,
  products: readonly OrderProduct[],
): PodLineGroup[] {
  const remaining = new Set(lines);
  const byName = (a: OrderProduct, b: OrderProduct) =>
    (a.fullProductName ?? '').localeCompare(b.fullProductName ?? '');
  const groupProducts = (
    items: readonly PodLine[],
    orderLine: PodOrderLine | null,
  ): PodProductGroup[] => {
    const groups = new Map<string, PodProductGroup>();
    for (const line of items) {
      const id = line.orderable.id;
      let group = groups.get(id);
      if (!group) {
        group = {
          product:
            products.find((product) => product.id === id) ??
            (orderLine?.orderable.id === id ? orderLine.orderable : { id }),
          collapsed: orderLine?.orderable.id === id,
          lines: [],
        };
        groups.set(id, group);
      }
      group.lines.push({ ...line, quantityShipped: shippedQuantity(line, shipmentLines) });
    }
    return [...groups.values()].sort((a, b) => byName(a.product, b.product));
  };
  const groups: PodLineGroup[] = [...orderLines]
    .sort((a, b) => byName(a.orderable, b.orderable))
    .map((orderLine) => {
      const ids = new Set([
        orderLine.orderable.id,
        ...(fulfills[orderLine.orderable.id]?.canFulfillForMe ?? []),
      ]);
      const matches = lines.filter((line) => ids.has(line.orderable.id));
      for (const line of matches) remaining.delete(line);
      return { orderLine, products: groupProducts(matches, orderLine) };
    })
    .filter((group) => group.products.length > 0);
  if (remaining.size)
    groups.push({ orderLine: null, products: groupProducts([...remaining], null) });
  return groups;
}
