type Reference = { id: string; href?: string };

export type SupplyPartnerAssociation = {
  id?: string;
  program: Reference;
  supervisoryNode: Reference;
  facilities: Reference[];
  orderables: Reference[];
};

export type SupplyPartner = {
  id: string;
  code: string;
  name: string;
  associations: SupplyPartnerAssociation[];
};

export type AssociationDraft = {
  programId: string;
  supervisoryNodeId: string;
  facilityIds: string[];
  orderableIds: string[];
};

export type SupplyPartnerDraft = {
  name: string;
  associations: AssociationDraft[];
};

export type SupplyPartnerBody = {
  id: string;
  code: string;
  name: string;
  associations: Omit<SupplyPartnerAssociation, 'id'>[];
};

export type SupplyPartnersQuery = { page: number; size: number };
