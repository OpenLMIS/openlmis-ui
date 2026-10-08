import { z } from 'zod';
import type { LotsQuery } from '@/features/lots/lib/types';
import { dateFilterSchema, tableSearchSchema, toPaginationState } from '@/lib/table-search';

export const LOT_HIDEABLE_COLUMNS = [
  { id: 'productCode', labelKey: 'lots.product-code', hideBelow: '3xl' },
  { id: 'productName', labelKey: 'lots.product-name' },
  { id: 'expirationDate', labelKey: 'lots.expiration-date', hideBelow: 'lg' },
  { id: 'manufactureDate', labelKey: 'lots.manufacture-date', hideBelow: '2xl' },
] as const;

const idSchema = z.guid().optional().catch(undefined);

export const lotsSearchSchema = tableSearchSchema(['lotCode'])
  .omit({ sort: true, dir: true })
  .extend({
    product: idSchema,
    expiryFrom: dateFilterSchema,
    expiryTo: dateFilterSchema,
    lot: idSchema,
  });

export type LotsSearch = z.infer<typeof lotsSearchSchema>;

export const CLEARED_LOT_FILTERS = {
  product: undefined,
  expiryFrom: undefined,
  expiryTo: undefined,
  page: undefined,
} satisfies Partial<LotsSearch>;

export function hasLotFilters(search: LotsSearch) {
  return Boolean(search.product || search.expiryFrom || search.expiryTo);
}

export function toLotsQuery(search: LotsSearch): LotsQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    page: pageIndex,
    size: pageSize,
    tradeItemIdIgnored: true,
    ...(search.product && { orderableId: search.product }),
    ...(search.expiryFrom && { expirationDateFrom: search.expiryFrom }),
    ...(search.expiryTo && { expirationDateTo: search.expiryTo }),
  };
}
