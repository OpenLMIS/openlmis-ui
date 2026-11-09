import type { ParseKeys } from 'i18next';

const ORDER_STATUSES = [
  'CREATING',
  'ORDERED',
  'FULFILLING',
  'SHIPPED',
  'RECEIVED',
  'TRANSFER_FAILED',
  'IN_ROUTE',
  'READY_TO_PACK',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS: Record<OrderStatus, ParseKeys> = {
  CREATING: 'orders.status.creating',
  ORDERED: 'orders.status.ordered',
  FULFILLING: 'orders.status.fulfilling',
  SHIPPED: 'orders.status.shipped',
  RECEIVED: 'orders.status.received',
  TRANSFER_FAILED: 'orders.status.transfer-failed',
  IN_ROUTE: 'orders.status.in-route',
  READY_TO_PACK: 'orders.status.ready-to-pack',
  CANCELLED: 'orders.status.cancelled',
};

export const VIEW_FILTER_STATUSES = ORDER_STATUSES.filter((status) => status !== 'CREATING');
export const FULFILL_STATUSES = ['ORDERED', 'FULFILLING'] as const;

export function orderStatusKey(status: string): ParseKeys | undefined {
  return Object.hasOwn(ORDER_STATUS, status) ? ORDER_STATUS[status as OrderStatus] : undefined;
}
