import type { Orderable } from '@/features/reference-data/lib/types';

export const productName = (product: Pick<Orderable, 'productCode' | 'fullProductName'>) =>
  product.fullProductName || product.productCode;
