import type { Orderable } from '@/features/reference-data/lib/types';

export type Lot = {
  id: string;
  lotCode: string;
  active: boolean;
  tradeItemId: string;
  expirationDate: string | null;
  manufactureDate: string | null;
  [key: string]: unknown;
};

/** A lot with the product of its trade item, or `null` when no product has it. */
export type LotRow = Lot & { product: Orderable | null };

export type LotsQuery = {
  page: number;
  size: number;
  /** Always sent, as legacy does; it only matters with a `tradeItemId`. */
  tradeItemIdIgnored: true;
  orderableId?: string;
  expirationDateFrom?: string;
  expirationDateTo?: string;
};
