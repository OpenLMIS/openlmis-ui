import { queryOptions } from '@tanstack/react-query';
import {
  fetchRejectionReason,
  fetchRejectionReasonCategory,
} from '@/features/rejection-reasons/api/api';
import { queryKeys } from '@/lib/key-factory';

export const rejectionReasonCategoryDetailOptions = (id: string, opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.rejectionReasonCategories.detail(id), opening] as const,
    queryFn: () => fetchRejectionReasonCategory(id),
  });

export const rejectionReasonDetailOptions = (id: string, opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.rejectionReasons.detail(id), opening] as const,
    queryFn: () => fetchRejectionReason(id),
  });
