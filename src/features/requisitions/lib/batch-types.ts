type BatchProduct = {
  id: string;
  productCode: string;
  fullProductName: string;
  netContent: number;
  packRoundingThreshold?: number | null;
  roundToZero: boolean;
};
export type BatchLine = {
  id: string;
  orderable: BatchProduct;
  approvedQuantity: number | null;
  pricePerPack?: number | null;
  skipped: boolean;
};
export type BatchRequisition = {
  id: string;
  status: string;
  modifiedDate: string;
  facilityName: string;
  periodName: string;
  requisitionLineItems: BatchLine[];
};
type BatchError = {
  requisitionId: string;
  errorMessage?: { message?: string; messageKey?: string } | null;
  fieldErrors?: Record<string, { message?: string; messageKey?: string }> | null;
};
export type BatchResponse = {
  requisitionDtos?: BatchRequisition[];
  requisitionErrors?: BatchError[];
  message?: string;
};
export type BatchQuantities = Readonly<Record<string, Readonly<Record<string, string>>>>;
export type BatchRow = { product: BatchProduct; lines: Map<string, BatchLine> };
