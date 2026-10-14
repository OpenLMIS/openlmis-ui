import { queryOptions } from '@tanstack/react-query';
import {
  fetchRequisitionGroup,
  searchRequisitionGroups,
} from '@/features/requisition-groups/api/api';
import type { RequisitionGroupsQuery } from '@/features/requisition-groups/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const requisitionGroupsSearchOptions = ({ page, size, ...body }: RequisitionGroupsQuery) =>
  queryOptions({
    queryKey: queryKeys.requisitionGroups.list({ ...body, page, size }),
    queryFn: () => searchRequisitionGroups(body, { page, size }),
  });

export const requisitionGroupOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.requisitionGroups.detail(id),
    queryFn: () => fetchRequisitionGroup(id),
  });
