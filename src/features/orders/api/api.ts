import type { CreateOrderBody, Order } from '@/features/orders/lib/types';
import { client } from '@/integrations/axios';

export async function createOrder(body: CreateOrderBody) {
  return (await client.post<Order>('/orders/requisitionLess', body)).data;
}
