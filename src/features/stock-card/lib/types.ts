import type { LotSummary } from '@/features/reference-data/lib/types';
import type { StockReason } from '@/lib/stock-labels';

export type CardReason = StockReason;

export type StockCardLine = {
  id: string;
  occurredDate: string;
  quantity: number;
  stockOnHand: number;
  reason?: CardReason | null;
  reasonFreeText?: string | null;
  source?: { name: string } | null;
  sourceFreeText?: string | null;
  destination?: { name: string } | null;
  destinationFreeText?: string | null;
  username?: string | null;
  signature?: string | null;
  documentNumber?: string | null;
  eventOrigin?: string | null;
  originEventId?: string | null;
  reversedEventId?: string | null;
  reversedEventDocumentNumber?: string | null;
  cancellationEventId?: string | null;
  cancellationEventDocumentNumber?: string | null;
  physicalInventory?: boolean;
  stockAdjustments?: { reason: CardReason; quantity: number }[] | null;
};

export type CardLineRow = StockCardLine & { rowId: string };

export type StockCard = {
  id: string;
  facility: { id: string; name: string; code: string };
  program: { id: string; name: string; code: string };
  orderable: {
    id: string;
    productCode: string;
    fullProductName: string;
    netContent?: number | null;
    dispensable?: { displayUnit?: string | null };
  };
  lot: LotSummary | null;
  stockOnHand: number;
  active: boolean;
  lineItems: StockCardLine[];
};
