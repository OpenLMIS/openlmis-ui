import type { LotSummary, Orderable } from '@/features/reference-data/lib/types';
import type { StockReason } from '@/lib/stock-labels';

export const EVENT_TYPES = ['issue', 'receive', 'adjustment'] as const;
export type EventTypeFilter = (typeof EVENT_TYPES)[number];

export type StockEventType = 'ISSUE' | 'RECEIVE' | 'ADJUSTMENT';

export type StockEventSummary = {
  id: string;
  documentNumber?: string | null;
  type?: StockEventType | null;
  signature?: string | null;
  occurredDate?: string | null;
  processedDate?: string | null;
  entriesCount?: number | null;
  userId?: string | null;
  username?: string | null;
  reversible?: boolean | null;
  facilityId: string;
  programId: string;
};

export type StockEventLineReason = StockReason & {
  id: string;
  tags: string[];
  isFreeTextAllowed: boolean;
};

export type StockEventLine = {
  orderable: {
    id: string;
    productCode: string;
    fullProductName: string;
    netContent?: number | null;
    dispensable?: { displayUnit?: string | null } | null;
  };
  lot: LotSummary | null;
  source?: { name: string } | null;
  sourceFreeText?: string | null;
  destination?: { name: string } | null;
  destinationFreeText?: string | null;
  quantity: number;
  occurredDate: string;
  reason?: StockEventLineReason | null;
  reasonFreeText?: string | null;
  stockOnHand: number;
  documentNumber?: string | null;
  reversedEventId?: string | null;
  reversedEventDocumentNumber?: string | null;
  cancellationEventId?: string | null;
  cancellationEventDocumentNumber?: string | null;
  stockEventLineItemId?: string | null;
};

export type StockEventsQuery = {
  facilityId: string;
  programId: string;
  page: number;
  size: number;
  type?: EventTypeFilter;
  startDate?: string;
  endDate?: string;
  documentNumber?: string;
};

export type PageQuery = { page: number; size: number };

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

export type StockEventCancel = {
  signature: string;
  lineItems: {
    stockEventLineItemId: string | null | undefined;
    reasonId: string;
    reasonFreeText?: string;
  }[];
};

export type StockEventCancelLineError = {
  stockEventLineItemId?: string | null;
  messageKey?: string;
  message?: string;
};

export type StockEventCancelError = {
  messageKey?: string;
  message?: string;
  lineErrors?: StockEventCancelLineError[];
};

export type EventStockOnHandFilter = EventStockCardsFilter & {
  orderableIds: readonly string[];
};

export type EventStockOnHand = Record<string, number | null>;

export type EventStockSummary = {
  canFulfillForMe: {
    orderable: { id: string };
    lot: { id: string } | null;
    stockOnHand: number | null;
  }[];
};
