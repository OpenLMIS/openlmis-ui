import type { ParseKeys } from 'i18next';

export const ORDER_STATUSES = [
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

export const ORDER_STATUS: Record<OrderStatus, { labelKey: ParseKeys }> = {
  CREATING: { labelKey: 'orders.status.creating' },
  ORDERED: { labelKey: 'orders.status.ordered' },
  FULFILLING: { labelKey: 'orders.status.fulfilling' },
  SHIPPED: { labelKey: 'orders.status.shipped' },
  RECEIVED: { labelKey: 'orders.status.received' },
  TRANSFER_FAILED: { labelKey: 'orders.status.transfer-failed' },
  IN_ROUTE: { labelKey: 'orders.status.in-route' },
  READY_TO_PACK: { labelKey: 'orders.status.ready-to-pack' },
  CANCELLED: { labelKey: 'orders.status.cancelled' },
};

export const VIEW_FILTER_STATUSES = ORDER_STATUSES.filter((status) => status !== 'CREATING');
export const FULFILL_STATUSES = ['ORDERED', 'FULFILLING'] as const;
