import { useQueryClient } from '@tanstack/react-query';
import { saveProductChange } from '@/features/products/api/api';
import { productDetailOptions } from '@/features/products/api/queries';
import type { ProductDetail } from '@/features/products/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';

export const productSaveKey = (productId: string) =>
  [...queryKeys.orderables.all, 'save', productId] as const;

type ProductChange = (latest: ProductDetail) => ProductDetail;

export function useProductSave(productId: string) {
  const queryClient = useQueryClient();
  return useSessionMutation({
    mutationKey: productSaveKey(productId),
    mutationFn: (change: ProductChange) => saveProductChange(productId, change),
    onSuccess: (saved) => {
      queryClient.setQueryData(productDetailOptions(productId).queryKey, saved);
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.orderables.all, 'list'] });
    },
  });
}
