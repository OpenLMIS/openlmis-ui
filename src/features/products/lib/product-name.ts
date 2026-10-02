import type { Product } from '@/features/products/lib/types';

export const productName = (product: Pick<Product, 'productCode' | 'fullProductName'>) =>
  product.fullProductName || product.productCode;
