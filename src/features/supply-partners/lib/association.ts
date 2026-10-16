import type { SupervisoryNode } from '@/features/reference-data/lib/types';
import type { AssociationDraft } from '@/features/supply-partners/lib/types';

export const associationKey = (
  association: Pick<AssociationDraft, 'programId' | 'supervisoryNodeId'>,
) => `${association.programId}:${association.supervisoryNodeId}`;

export function availablePartnerNodes(
  nodes: readonly SupervisoryNode[],
  programId: string,
  associations: readonly AssociationDraft[],
  editingKey?: string,
) {
  const used = new Set(
    associations.filter((item) => associationKey(item) !== editingKey).map(associationKey),
  );
  return nodes.filter(
    (node) =>
      node.partnerNodeOf && !used.has(associationKey({ programId, supervisoryNodeId: node.id })),
  );
}

export function pruneAssociationProducts(
  association: AssociationDraft,
  remainingFacilityIds: readonly string[],
  approvedOrderableIds: readonly string[],
) {
  const approved = new Set(remainingFacilityIds.length ? approvedOrderableIds : []);
  return {
    association: {
      ...association,
      facilityIds: [...remainingFacilityIds],
      orderableIds: association.orderableIds.filter((id) => approved.has(id)),
    },
    removedOrderableIds: association.orderableIds.filter((id) => !approved.has(id)),
  };
}
