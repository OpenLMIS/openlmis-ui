import { useAppForm } from '@/components/form/form';
import type { PodDraft } from '@/features/orders/lib/pod-types';
export function usePodForm(initial: PodDraft) {
  return useAppForm({ defaultValues: initial });
}
export type PodForm = ReturnType<typeof usePodForm>;
