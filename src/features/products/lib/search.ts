import { z } from 'zod';
import type { ProductsQuery } from '@/features/products/lib/types';
import {
  type DefaultSort,
  tableSearchSchema,
  textFilterSchema,
  toPaginationState,
  toSortParam,
} from '@/lib/table-search';

export const PRODUCT_HIDEABLE_COLUMNS = [
  { id: 'description', labelKey: 'products.description', hideBelow: '2xl' },
] as const;

export const DEFAULT_PRODUCTS_SORT: DefaultSort = { id: 'fullProductName', desc: false };

export const PRODUCTS_SORT_PARAM = toSortParam({}, DEFAULT_PRODUCTS_SORT);

export const productsSearchSchema = tableSearchSchema(['fullProductName'])
  .omit({ sort: true, dir: true })
  .extend({
    q: textFilterSchema,
    program: textFilterSchema,
    product: z.literal('new').optional().catch(undefined),
  });

export type ProductsSearch = z.infer<typeof productsSearchSchema>;

export const CLEARED_PRODUCT_FILTERS = {
  q: undefined,
  program: undefined,
  page: undefined,
} satisfies Partial<ProductsSearch>;

export function hasProductFilters(search: ProductsSearch) {
  return Boolean(search.q || search.program);
}

export function toProductsQuery(search: ProductsSearch): ProductsQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    page: pageIndex,
    size: pageSize,
    sort: PRODUCTS_SORT_PARAM,
    q: search.q?.trim(),
    program: search.program?.trim(),
  };
}
