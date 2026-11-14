import type { HistoryState } from '@tanstack/react-router';
import type {
  FulfillOrdersSearch,
  PodListSearch,
  ViewOrdersSearch,
} from '@/features/orders/lib/order-search';

export type OrderReturn =
  | { to: '/orders/view'; search: ViewOrdersSearch }
  | { to: '/orders/fulfillment'; search: FulfillOrdersSearch }
  | { to: '/orders/proof-of-delivery'; search: PodListSearch };
export const orderReturnState = (target: OrderReturn): HistoryState => ({ orderReturn: target });
export const orderReturnTarget = <T>(state: HistoryState, fallback: T): OrderReturn | T =>
  state.orderReturn ?? fallback;

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: router history requires interface merging.
  interface HistoryState {
    orderReturn?: OrderReturn;
  }
}
