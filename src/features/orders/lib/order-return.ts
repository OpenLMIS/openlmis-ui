import type { HistoryState } from '@tanstack/react-router';
import type { ViewOrdersSearch } from '@/features/orders/lib/order-search';

export type OrderReturn = { to: '/orders/view'; search: ViewOrdersSearch };
export const orderReturnState = (target: OrderReturn): HistoryState => ({ orderReturn: target });
export const orderReturnTarget = (state: HistoryState) =>
  state.orderReturn ?? { to: '/requisitions/create-orders' as const, search: {} };

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: router history requires interface merging.
  interface HistoryState {
    orderReturn?: OrderReturn;
  }
}
