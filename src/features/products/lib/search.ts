import { z } from 'zod';
import type { ProductsQuery } from '@/features/products/lib/types';
import { tableSearchSchema, textFilterSchema, toPaginationState } from '@/lib/table-search';

/** View menu columns; code and name are left out, so they always show. */
export const PRODUCT_HIDEABLE_COLUMNS = [
  { id: 'description', labelKey: 'products.description', hideBelow: '2xl' },
] as const;

/** The server orders any filtered list by name whatever `sort` says, so the list has one order. */
const PRODUCTS_SORT = 'fullProductName,asc';

export const productsSearchSchema = tableSearchSchema(['fullProductName'])
  .omit({ sort: true, dir: true })
  .extend({
    code: textFilterSchema,
    name: textFilterSchema,
    /** A program code, as the API and the legacy URL take it. */
    program: textFilterSchema,
    product: z.literal('new').optional().catch(undefined),
  });

export type ProductsSearch = z.infer<typeof productsSearchSchema>;

/** Every filter off and back to the first page. */
export const CLEARED_PRODUCT_FILTERS = {
  code: undefined,
  name: undefined,
  program: undefined,
  page: undefined,
} satisfies Partial<ProductsSearch>;

export function hasProductFilters(search: ProductsSearch) {
  return Boolean(search.code || search.name || search.program);
}

export function toProductsQuery(search: ProductsSearch): ProductsQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    page: pageIndex,
    size: pageSize,
    sort: PRODUCTS_SORT,
    code: search.code?.trim(),
    name: search.name?.trim(),
    program: search.program?.trim(),
  };
}
