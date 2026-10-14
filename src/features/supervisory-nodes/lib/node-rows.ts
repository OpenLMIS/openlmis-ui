import type { Facility } from '@/features/reference-data/lib/types';
import type { NodeRow, SupervisoryNode } from '@/features/supervisory-nodes/lib/types';
import { tableValue } from '@/lib/empty-value';

export function toNodeRows(
  nodes: readonly SupervisoryNode[],
  facilities: readonly Pick<Facility, 'id' | 'name' | 'geographicZone'>[],
  partners: readonly Pick<SupervisoryNode, 'id' | 'name'>[],
): NodeRow[] {
  const facilitiesById = new Map(facilities.map((facility) => [facility.id, facility]));
  const partnersById = new Map(partners.map((partner) => [partner.id, partner]));
  return nodes.map((node) => {
    const facility = node.facility ? facilitiesById.get(node.facility.id) : undefined;
    return {
      id: node.id,
      code: node.code,
      name: node.name,
      facilityName: tableValue(facility?.name),
      zoneName: tableValue(facility?.geographicZone?.name),
      childCount: node.childNodes.length,
      partners: node.partnerNodes.map(({ id }) => ({ id, name: partnersById.get(id)?.name ?? '' })),
    };
  });
}
