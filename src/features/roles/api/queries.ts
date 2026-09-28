import { queryOptions } from '@tanstack/react-query';
import type { RightType } from '@/features/reference-data/lib/types';
import { fetchRightsByType, fetchRole } from '@/features/roles/api/api';
import { queryKeys } from '@/lib/key-factory';

export const roleDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.roles.detail(id),
    queryFn: () => fetchRole(id),
  });

export const rightsByTypeOptions = (type: RightType) =>
  queryOptions({
    queryKey: queryKeys.rights.list({ type }),
    queryFn: () => fetchRightsByType(type),
    // The rights a type offers change only with a new release or report.
    staleTime: 10 * 60 * 1000,
  });
