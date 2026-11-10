export type ShipmentStockCard = {
  orderable: { id: string };
  lot?: { id: string } | null;
  stockOnHand: number | null;
  stockCard: { id: string };
  active: boolean;
};
export type ShipmentSummary = {
  orderable: { id: string };
  stockOnHand: number | null;
  canFulfillForMe?: ShipmentStockCard[];
};
export type ShipmentSavedLine = {
  id?: string;
  orderable: { id: string; versionNumber: number };
  lot: { id: string } | null;
  quantityShipped: number | null;
};
export type ShipmentRecord = {
  id: string;
  order: { id: string };
  notes?: string | null;
  lineItems: ShipmentSavedLine[];
};
export type ShipmentBody = {
  order: { id: string };
  notes?: string | null;
  lineItems: ShipmentSavedLine[];
};
export type ShipmentDraftBody = ShipmentBody & { id: string };
export type ShipmentStockFilter = {
  programId: string;
  facilityId: string;
  orderableIds: readonly string[];
};
