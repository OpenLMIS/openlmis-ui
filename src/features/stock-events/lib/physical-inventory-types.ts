import type { QuantityValue } from '@/components/form/quantity-value';
import type { LotSummary, Orderable } from '@/features/reference-data/lib/types';

export type InventoryScope = { facilityId: string; programId: string };
export type InventoryAdjustment = {
  reason: { id: string; name?: string; reasonType?: string };
  quantity: number;
};
export type InventoryDraftItem = {
  orderableId: string;
  lotId?: string | null;
  quantity?: number | null;
  extraData?: { vvmStatus?: string | null };
  stockAdjustments?: InventoryAdjustment[];
};
export type PhysicalInventoryDraft = InventoryScope & {
  id: string;
  lineItems: InventoryDraftItem[];
};
export type InventorySummary = {
  orderable: { id: string; versionNumber?: number };
  canFulfillForMe: {
    orderable: { id: string };
    lot?: { id: string } | null;
    stockOnHand: number | null;
    stockCard?: { id: string } | null;
    active?: boolean;
  }[];
};
export type InventoryStockLine = {
  orderable: Orderable;
  lot: LotSummary | null;
  stockOnHand: number | null;
  stockCardId?: string | null;
  active?: boolean;
};
export type InventoryLine = InventoryStockLine & {
  key: string;
  quantity: QuantityValue;
  stockAdjustments: InventoryAdjustment[];
  vvmStatus: string | null;
  isAdded: boolean;
  justAdded: boolean;
  newLot?: {
    clientId: string;
    lotCode: string;
    expirationDate: string | null;
    tradeItemId: string;
  };
};
export type InventoryProductGroup = { orderable: Orderable; lines: InventoryLine[] };
export type InventoryCategoryBand = { category: string; groups: InventoryProductGroup[] };
