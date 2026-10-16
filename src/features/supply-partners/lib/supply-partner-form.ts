import type {
  SupplyPartner,
  SupplyPartnerBody,
  SupplyPartnerDraft,
} from '@/features/supply-partners/lib/types';

export function toSupplyPartnerDraft(saved: SupplyPartner): SupplyPartnerDraft {
  return {
    name: saved.name,
    associations: saved.associations.map((item) => ({
      programId: item.program.id,
      supervisoryNodeId: item.supervisoryNode.id,
      facilityIds: item.facilities.map(({ id }) => id),
      orderableIds: item.orderables.map(({ id }) => id),
    })),
  };
}

export function toSupplyPartnerBody(
  saved: SupplyPartner,
  draft: SupplyPartnerDraft,
): SupplyPartnerBody {
  return {
    id: saved.id,
    code: saved.code,
    name: draft.name,
    associations: draft.associations.map((item) => ({
      program: { id: item.programId },
      supervisoryNode: { id: item.supervisoryNodeId },
      facilities: item.facilityIds.map((id) => ({ id })),
      orderables: item.orderableIds.map((id) => ({ id })),
    })),
  };
}

export function canonicalSupplyPartner(partner: SupplyPartnerBody) {
  const associations = partner.associations.map((item) => ({
    programId: item.program.id,
    supervisoryNodeId: item.supervisoryNode.id,
    facilityIds: item.facilities.map(({ id }) => id).toSorted(),
    orderableIds: item.orderables.map(({ id }) => id).toSorted(),
  }));
  associations.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify({ code: partner.code, name: partner.name, associations });
}
