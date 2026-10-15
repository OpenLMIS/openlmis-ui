import { queryOptions } from '@tanstack/react-query';
import {
  fetchRejectionReason,
  fetchRejectionReasonCategory,
} from '@/features/rejection-reasons/api/api';
import { queryKeys } from '@/lib/key-factory';

export const rejectionReasonCategoryDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.rejectionReasonCategories.detail(id),
    queryFn: () => fetchRejectionReasonCategory(id),
  });

export const rejectionReasonDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.rejectionReasons.detail(id),
    queryFn: () => fetchRejectionReason(id),
  });
