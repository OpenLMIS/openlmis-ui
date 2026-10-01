import type { CreateProductBody, Product, ProductsQuery } from '@/features/products/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchProducts(query: ProductsQuery) {
  const { data } = await client.get<Page<Product>>('/orderables', { params: query });
  return data;
}

export async function createProduct(body: CreateProductBody) {
  const { data } = await client.put<Product>('/orderables', body);
  return data;
}
