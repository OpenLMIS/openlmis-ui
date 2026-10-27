import { queryOptions } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { facilitiesByIdsOptions } from '@/features/reference-data/api/queries';
import { searchRequisitionGroups } from '@/features/requisition-groups/api/api';
import type {
  RequisitionGroup,
  RequisitionGroupsQuery,
} from '@/features/requisition-groups/lib/types';
import { queryKeys } from '@/lib/key-factory';
import type { Page } from '@/lib/types';

type SearchPage = Page<RequisitionGroup> & { unknownFilter?: boolean };

export const requisitionGroupsSearchOptions = (query: RequisitionGroupsQuery) =>
  queryOptions({
    queryKey: queryKeys.requisitionGroups.list(query),
    queryFn: async ({ client }): Promise<SearchPage> => {
      const { page, size, ...body } = query;
      try {
        const result = await searchRequisitionGroups(body, { page, size });
        const ids = requisitionGroupNodeFacilityIds(result.content);
        if (ids.length > 0) client.prefetchQuery(facilitiesByIdsOptions(ids));
        return result;
      } catch (error) {
        const messageKey =
          isAxiosError<{ messageKey?: string }>(error) && error.response?.status === 400
            ? error.response.data?.messageKey
            : undefined;
        if (
          messageKey === 'referenceData.error.geographicZone.notFound' ||
          messageKey === 'referenceData.error.program.notFound'
        ) {
          return {
            content: [],
            totalElements: 0,
            totalPages: 0,
            number: page,
            size,
            unknownFilter: true,
          };
        }
        throw error;
      }
    },
  });

export function requisitionGroupNodeFacilityIds(groups: RequisitionGroup[]) {
  return [
    ...new Set(
      groups.flatMap((group) =>
        group.supervisoryNode.facility?.id ? [group.supervisoryNode.facility.id] : [],
      ),
    ),
  ].sort();
}

export { requisitionGroupOptions } from '@/features/reference-data/api/queries';
