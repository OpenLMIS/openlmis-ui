import { queryOptions } from '@tanstack/react-query';
import {
  fetchReason,
  fetchReasonCategories,
  fetchReasonTags,
  fetchReasonTypes,
  fetchValidReasons,
} from '@/features/reasons/api/api';
import { queryKeys } from '@/lib/key-factory';

// Fixed by the server, so one fetch serves the session.
const FIXED = Number.POSITIVE_INFINITY;

export const reasonDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.reasons.detail(id),
    queryFn: () => fetchReason(id),
  });

export const reasonTypesOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.reasons.all, 'types'] as const,
    queryFn: fetchReasonTypes,
    staleTime: FIXED,
  });

export const reasonCategoriesOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.reasons.all, 'categories'] as const,
    queryFn: fetchReasonCategories,
    staleTime: FIXED,
  });

export const reasonTagsOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.reasons.all, 'tags'] as const,
    queryFn: fetchReasonTags,
  });

export const validReasonsOptions = (reasonId: string) =>
  queryOptions({
    queryKey: queryKeys.validReasons.list({ reason: reasonId }),
    queryFn: () => fetchValidReasons(reasonId),
  });
