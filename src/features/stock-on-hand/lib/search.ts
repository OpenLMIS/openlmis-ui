import { z } from 'zod';
import type { StockCardSummariesQuery } from '@/features/stock-on-hand/lib/types';
import { facilityProgramSearchSchema } from '@/lib/facility-program-selection';
import { tableSearchSchema, textFilterSchema, toPaginationState } from '@/lib/table-search';

export const stockOnHandSearchSchema = tableSearchSchema(['productCode'])
  .omit({ sort: true, dir: true })
  .extend({
    ...facilityProgramSearchSchema.shape,
    productCode: textFilterSchema,
    productName: textFilterSchema,
    lotCode: textFilterSchema,
    includeInactive: z.boolean().optional().catch(undefined),
  });

export type StockOnHandSearch = z.infer<typeof stockOnHandSearchSchema>;

export const CLEARED_STOCK_FILTERS = {
  productCode: undefined,
  productName: undefined,
  lotCode: undefined,
  includeInactive: undefined,
  page: undefined,
} satisfies Partial<StockOnHandSearch>;

/** Legacy lists inactive cards until the box is turned off, so no choice means shown. */
export const showsInactive = (search: Pick<StockOnHandSearch, 'includeInactive'>) =>
  search.includeInactive !== false;

export function hasStockFilters(search: StockOnHandSearch) {
  return Boolean(
    search.productCode || search.productName || search.lotCode || !showsInactive(search),
  );
}

export function toSummariesQuery(
  search: StockOnHandSearch,
  { facilityId, programId }: { facilityId: string; programId: string },
): StockCardSummariesQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  const text = (value: string | undefined) => value?.trim() || undefined;
  const orderableCode = text(search.productCode);
  const orderableName = text(search.productName);
  const lotCode = text(search.lotCode);
  return {
    facilityId,
    programId,
    nonEmptyOnly: true,
    page: pageIndex,
    size: pageSize,
    ...(orderableCode && { orderableCode }),
    ...(orderableName && { orderableName }),
    ...(lotCode && { lotCode }),
  };
}
