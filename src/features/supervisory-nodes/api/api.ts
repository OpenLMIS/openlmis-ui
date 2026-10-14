import { fetchFacilitiesByIds } from '@/features/reference-data/api/api';
import type { NodeBodyResult } from '@/features/supervisory-nodes/lib/node-form';
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

export async function fetchSupervisoryNode(id: string) {
  const { data } = await client.get<SupervisoryNode>(`/supervisoryNodes/${id}`);
  return data;
}

export async function updateSupervisoryNode(id: string, body: SupervisoryNode) {
  const { data } = await client.put<SupervisoryNode>(`/supervisoryNodes/${id}`, body);
  return data;
}

export class SupervisoryNodeConflictError extends Error {
  constructor() {
    super('Supervisory node hierarchy changed');
    this.name = 'SupervisoryNodeConflictError';
  }
}

export async function saveSupervisoryNodeChange(
  id: string,
  change: (latest: SupervisoryNode) => NodeBodyResult,
) {
  const scope = getSessionScope();
  assertSessionScope(scope);
  const latest = await fetchSupervisoryNode(id);
  assertSessionScope(scope);
  const result = change(latest);
  if (!result.ok) throw new SupervisoryNodeConflictError();
  const saved = await updateSupervisoryNode(id, result.body);
  assertSessionScope(scope);
  return saved;
}
