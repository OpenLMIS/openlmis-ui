import type { Order, OrderProduct } from '@/features/orders/lib/types';
export type PodStatus = 'INITIATED' | 'CONFIRMED';
export type PodLine = {
  id: string;
  orderable: { id: string; versionNumber: number };
  lot?: { id: string } | null;
  quantityAccepted: number | null;
  quantityRejected: number | null;
  vvmStatus: string | null;
  useVvm: boolean;
  rejectionReasonId: string | null;
  notes: string | null;
};
export type PodShipmentLine = {
  orderable: { id: string };
  lot?: { id: string } | null;
  quantityShipped: number | null;
};
export type PodOrder = Order & {
  facility: { id: string; code?: string | null; name?: string | null; type: { id: string } };
  processingPeriod?: { startDate: string | null; endDate: string | null } | null;
};
export type PodFooter = { receivedBy: string; deliveredBy: string; receivedDate: string };
export type PodLineDraft = { accepted: string; reason: string; vvm: string; notes: string };
export type PodDraft = PodFooter & { lines: Record<string, PodLineDraft> };
export type PodWritableLine = Pick<
  PodLine,
  'id' | 'quantityAccepted' | 'quantityRejected' | 'vvmStatus' | 'rejectionReasonId' | 'notes'
>;
export type PodBody = {
  shipment: { id: string };
  status: PodStatus;
  receivedBy: string | null;
  deliveredBy: string | null;
  receivedDate: string | null;
  lineItems: PodWritableLine[];
};
export type PodResponse = Omit<PodBody, 'lineItems'> & { id: string; lineItems: PodLine[] };
export type ProofOfDelivery = Omit<PodResponse, 'shipment'> & {
  shipment: { id: string; order: PodOrder; lineItems: PodShipmentLine[] };
};
export type PodOrderLine = { id?: string; orderable: OrderProduct; orderedQuantity: number | null };
