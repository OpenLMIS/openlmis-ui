import type {
  CreateProductBody,
  Product,
  ProductDetail,
  ProductsQuery,
} from '@/features/products/lib/types';
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

export async function fetchProduct(id: string) {
  const { data } = await client.get<ProductDetail>(`/orderables/${id}`);
  return data;
}

export async function updateProduct(id: string, body: ProductDetail) {
  const { data } = await client.put<ProductDetail>(`/orderables/${id}`, body);
  return data;
}
