import { queryOptions } from '@tanstack/react-query';
import { fetchProduct, fetchProducts } from '@/features/products/api/api';
import type { ProductsQuery } from '@/features/products/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const productsListOptions = (query: ProductsQuery) =>
  queryOptions({
    queryKey: queryKeys.orderables.list(query),
    queryFn: () => fetchProducts(query),
  });

export const productDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.orderables.detail(id),
    queryFn: () => fetchProduct(id),
  });
