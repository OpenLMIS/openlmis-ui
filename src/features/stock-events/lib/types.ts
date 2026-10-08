import type { LotSummary, Orderable } from '@/features/reference-data/lib/types';

export type EventStockCard = {
  id?: string;
  stockOnHand: number;
  orderable: Omit<Orderable, 'description'> & { description?: string | null };
  lot: LotSummary | null;
};

export type EventStockCardsFilter = { programId: string; facilityId: string };

export type StockEventLineItem = {
  orderableId: string;
  lotId?: string | null;
  quantity: number;
  occurredDate: string;
  reasonId?: string | null;
  reasonFreeText?: string | null;
  extraData?: { vvmStatus?: 'STAGE_1' | 'STAGE_2' };
};

export type StockEvent = {
  programId: string;
  facilityId: string;
  signature?: string;
  eventOrigin: 'ADJUSTMENT' | 'ISSUE' | 'RECEIVE' | 'KIT_UNPACK';
  lineItems: StockEventLineItem[];
};
