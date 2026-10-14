import { queryOptions } from '@tanstack/react-query';
import {
  fetchAvailableColumns,
  fetchRequisitionTemplates,
} from '@/features/requisition-templates/api/api';
import { queryKeys } from '@/lib/key-factory';

const LOOKUP_STALE_TIME = 10 * 60 * 1000;

export const requisitionTemplatesOptions = () =>
  queryOptions({
    queryKey: queryKeys.requisitionTemplates.list(),
    queryFn: fetchRequisitionTemplates,
    staleTime: LOOKUP_STALE_TIME,
  });

export const availableColumnsOptions = () =>
  queryOptions({
    queryKey: queryKeys.availableRequisitionColumns.list(),
    queryFn: fetchAvailableColumns,
    staleTime: LOOKUP_STALE_TIME,
  });
