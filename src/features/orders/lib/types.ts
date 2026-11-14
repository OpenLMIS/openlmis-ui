import type { Page } from '@/lib/types';

export type OrderFacility = { id: string; name?: string | null; code?: string | null };
export type OrderProduct = {
  id: string;
  netContent?: number | null;
  productCode?: string | null;
  fullProductName?: string | null;
  description?: string | null;
  dispensable?: { displayUnit?: string | null } | null;
  extraData?: { useVVM?: string | null } | null;
  meta?: { versionNumber?: number | null } | null;
  packRoundingThreshold?: number | null;
  roundToZero?: boolean | null;
};
export type Order = {
  id: string;
  status: string;
  orderCode?: string | null;
  emergency?: boolean | null;
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

export type OrderSummary = {
  id: string;
  orderCode: string | null;
  status: string;
  emergency: boolean;
  facility: {
    id: string;
    code: string | null;
    name: string | null;
    type?: { id: string };
    geographicZone: { name: string | null } | null;
  } | null;
  program: { id: string; name: string | null } | null;
  processingPeriod: {
    id: string;
    name: string | null;
    startDate: string | null;
    endDate: string | null;
  } | null;
  createdDate: string | null;
  lastUpdatedDate: string | null;
  requestingFacility: { id: string; code: string | null; name: string | null } | null;
  supplyingFacility: { id: string; name: string | null; code: string | null } | null;
};
export type OrdersPage = Page<OrderSummary>;
export type OrderStockFilter = {
  programId: string;
  facilityId: string;
  orderableIds: readonly string[];
};
