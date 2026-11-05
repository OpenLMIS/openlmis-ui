import type { Orderable } from '@/features/reference-data/lib/types';

export type OrderFacility = { id: string; name?: string | null; code?: string };
export type OrderProduct = Orderable & {
  packRoundingThreshold?: number | null;
  roundToZero?: boolean | null;
};
export type Order = {
  id: string;
  status: string;
  createdDate?: string;
  program: { id: string; name?: string | null };
  requestingFacility: OrderFacility;
  receivingFacility: OrderFacility;
  supplyingFacility: OrderFacility;
  orderLineItems: { id?: string; orderable: OrderProduct; orderedQuantity: number | null }[];
};
export type CreateOrderBody = {
  emergency: true;
  createdBy: { id: string };
  program: { id: string };
  requestingFacility: { id: string };
  receivingFacility: { id: string };
  supplyingFacility: { id: string };
  facility: { id: string };
};
