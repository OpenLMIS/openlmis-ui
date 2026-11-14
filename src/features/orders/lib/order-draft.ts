import { type QuantityValue, quantityValue } from '@/components/form/quantity-value';
import type { Order, OrderProduct } from '@/features/orders/lib/types';
import { randomId } from '@/lib/random-id';
import { MAX_WHOLE_NUMBER, toLatinDigits, toWholeNumber } from '@/lib/whole-number';

export type DraftLine = {
  key: string;
  id?: string;
  product: OrderProduct;
  quantity: QuantityValue;
};
export type OrderBody = Omit<Order, 'orderLineItems'> & {
  orderLineItems: {
    id?: string;
    orderable: { id: string; meta: { versionNumber?: number | null } };
    orderedQuantity: number;
  }[];
};
export const orderIds = (value: string) => [
  ...new Set(
    value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  ),
];
export function draftLines(order: Order): DraftLine[] {
  return order.orderLineItems.map((line) => ({
    key: randomId(),
    id: line.id,
    product: line.orderable,
    quantity: quantityValue(
      line.orderedQuantity == null ? '' : String(line.orderedQuantity),
      line.orderable.netContent,
    ),
  }));
}
export function orderBody(order: Order, lines: readonly DraftLine[]): OrderBody {
  return {
    ...order,
    orderLineItems: lines.map((line) => ({
      ...(line.id && { id: line.id }),
      orderable: {
        id: line.product.id,
        meta: { versionNumber: line.product.meta?.versionNumber },
      },
      orderedQuantity: toWholeNumber(line.quantity.doses),
    })),
  };
}
export function validQuantity(value: QuantityValue, create = false) {
  const text = toLatinDigits(value.doses.trim());
  return /^\d+$/.test(text) && Number(text) <= MAX_WHOLE_NUMBER && (!create || Number(text) > 0);
}
export function validLines(lines: readonly DraftLine[], create: boolean) {
  return (
    (!create || lines.length > 0) &&
    lines.every((line) => validQuantity(line.quantity, create)) &&
    new Set(lines.map((line) => line.product.id)).size === lines.length
  );
}
export function isChanged(lines: readonly DraftLine[], baseline: readonly DraftLine[]) {
  const values = (items: readonly DraftLine[]) =>
    items.map((line) => [line.product.id, line.product.meta?.versionNumber, line.quantity.doses]);
  return JSON.stringify(values(lines)) !== JSON.stringify(values(baseline));
}
export function mergeSavedLines(
  live: readonly DraftLine[],
  submitted: readonly DraftLine[],
  response: Order,
): DraftLine[] {
  return live.map((line) => {
    const previous = submitted.find(
      (item) =>
        item.key === line.key &&
        item.product.id === line.product.id &&
        item.product.meta?.versionNumber === line.product.meta?.versionNumber,
    );
    if (!previous) return line;
    const saved = response.orderLineItems.find(
      (item) =>
        item.orderable.id === line.product.id &&
        item.orderable.meta?.versionNumber === line.product.meta?.versionNumber,
    );
    return saved ? { ...line, id: saved.id } : line;
  });
}
