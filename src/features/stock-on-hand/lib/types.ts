import type { LotSummary, Orderable } from '@/features/reference-data/lib/types';

/** One stock card that can fill the product: the product itself, a lot of it, or a substitute. */
export type StockCardSummaryEntry = {
  stockCard: { id: string } | null;
  orderable: { id: string };
  lot: { id: string } | null;
  stockOnHand: number | null;
  occurredDate: string | null;
  processedDate?: string | null;
  active: boolean;
};

export type StockCardSummary = {
  orderable: { id: string; versionNumber?: number };
  stockOnHand: number | null;
  canFulfillForMe: StockCardSummaryEntry[];
};

export type StockCardSummariesQuery = {
  facilityId: string;
  programId: string;
  nonEmptyOnly: true;
  page: number;
  size: number;
  orderableCode?: string;
  orderableName?: string;
  lotCode?: string;
};

/** A card's product or lot is `undefined` while unnamed, when its lookup did not list it. */
export type StockCardRow = {
  id: string;
  stockCardId: string | null;
  product: Orderable | undefined;
  lot: LotSummary | undefined | null;
  stockOnHand: number | null;
  occurredDate: string | null;
  active: boolean;
};

export type StockProductGroup = {
  id: string;
  product: Orderable | undefined;
  stockOnHand: number | null;
  cards: StockCardRow[];
};
