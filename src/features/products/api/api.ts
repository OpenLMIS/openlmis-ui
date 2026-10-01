import type { CreateProductBody, Product, ProductsQuery } from '@/features/products/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchProducts(query: ProductsQuery) {
  const { data } = await client.get<Page<Product>>('/orderables', { params: query });
  return data;
}

/** Without an id, `PUT` creates; the orderables API has no `POST`. */
export async function createProduct(body: CreateProductBody) {
  const { data } = await client.put<Product>('/orderables', body);
  return data;
}
