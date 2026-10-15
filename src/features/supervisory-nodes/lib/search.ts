import { z } from 'zod';
import type { SupervisoryNodesQuery } from '@/features/supervisory-nodes/lib/types';
import { tableSearchSchema, textFilterSchema, toPaginationState } from '@/lib/table-search';

export const SUPERVISORY_NODE_HIDEABLE_COLUMNS = [
  { id: 'code', labelKey: 'supervisory-nodes.code' },
  { id: 'facilityName', labelKey: 'supervisory-nodes.facility' },
  { id: 'childCount', labelKey: 'supervisory-nodes.child-nodes' },
  { id: 'zoneName', labelKey: 'supervisory-nodes.zone' },
  { id: 'partners', labelKey: 'supervisory-nodes.partner-nodes' },
] as const;

export const supervisoryNodesSearchSchema = tableSearchSchema(['name'])
  .omit({ sort: true, dir: true })
  .extend({
    name: textFilterSchema,
    zoneId: z.guid().optional().catch(undefined),
  });

export type SupervisoryNodesSearch = z.infer<typeof supervisoryNodesSearchSchema>;

export const CLEARED_SUPERVISORY_NODE_FILTERS = {
  name: undefined,
  zoneId: undefined,
  page: undefined,
} satisfies Partial<SupervisoryNodesSearch>;

export function hasSupervisoryNodeFilters(search: SupervisoryNodesSearch) {
  return Boolean(search.name || search.zoneId);
}

export function toSupervisoryNodesQuery(search: SupervisoryNodesSearch): SupervisoryNodesQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    page: pageIndex,
    size: pageSize,
    ...(search.name?.trim() && { name: search.name.trim() }),
    ...(search.zoneId && { zoneId: search.zoneId }),
  };
}
