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

export const productsSearchSchema = tableSearchSchema(['fullProductName'])
  .omit({ sort: true, dir: true })
  .extend({
    code: textFilterSchema,
    name: textFilterSchema,
    program: textFilterSchema,
    product: z.literal('new').optional().catch(undefined),
  });

export type ProductsSearch = z.infer<typeof productsSearchSchema>;

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
    sort: toSortParam({}, DEFAULT_PRODUCTS_SORT),
    code: search.code?.trim(),
    name: search.name?.trim(),
    program: search.program?.trim(),
  };
}
