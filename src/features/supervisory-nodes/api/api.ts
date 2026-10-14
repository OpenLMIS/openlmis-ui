import { fetchFacilitiesByIds } from '@/features/reference-data/api/api';
import { toNodeRows } from '@/features/supervisory-nodes/lib/node-rows';
import type {
  SupervisoryNode,
  SupervisoryNodesQuery,
} from '@/features/supervisory-nodes/lib/types';
import { client } from '@/integrations/axios';
import { fetchByIds } from '@/lib/fetch-by-ids';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

export async function fetchSupervisoryNodesPage({
  name,
  zoneId,
  page,
  size,
}: SupervisoryNodesQuery) {
  const { data } = await client.get<Page<SupervisoryNode>>('/supervisoryNodes', {
    params: {
      page,
      size,
      ...(name?.trim() && { name: name.trim() }),
      ...(zoneId && { zoneId }),
    },
  });
  return data;
}

export function fetchSupervisoryNodesByIds(ids: readonly string[]) {
  return fetchByIds<SupervisoryNode>('/supervisoryNodes', ids);
}

export async function fetchSupervisoryNodeRows(query: SupervisoryNodesQuery) {
  const scope = getSessionScope();
  const data = await fetchSupervisoryNodesPage(query);
  assertSessionScope(scope);
  const facilityIds = [
    ...new Set(data.content.flatMap((node) => (node.facility ? [node.facility.id] : []))),
  ];
  const partnerIds = [
    ...new Set(data.content.flatMap((node) => node.partnerNodes.map(({ id }) => id))),
  ];
  const [facilities, partners] = await Promise.all([
    fetchFacilitiesByIds(facilityIds),
    fetchSupervisoryNodesByIds(partnerIds),
  ]);
  assertSessionScope(scope);
  return { ...data, content: toNodeRows(data.content, facilities, partners) };
}
