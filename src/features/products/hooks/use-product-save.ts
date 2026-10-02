import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProduct } from '@/features/products/api/api';
import { productDetailOptions } from '@/features/products/api/queries';
import type { ProductDetail } from '@/features/products/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const productSaveKey = (productId: string) =>
  [...queryKeys.orderables.all, 'save', productId] as const;

export function useProductSave(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: productSaveKey(productId),
    mutationFn: (body: ProductDetail) => updateProduct(productId, body),
    onSuccess: (saved) => {
      queryClient.setQueryData(productDetailOptions(productId).queryKey, saved);
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.orderables.all, 'list'] });
    },
  });
}
