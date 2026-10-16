export type SupplyLineNamedReference = {
  id?: string;
  name?: string | null;
};

export type SupplyLine = {
  id: string;
  supplyingFacility?: SupplyLineNamedReference | null;
  supervisoryNode?: { id?: string; code?: string | null } | null;
  program?: SupplyLineNamedReference | null;
  description?: string | null;
};

export type SupplyLinesQuery = {
  page: number;
  size: number;
  sort: string;
  supplyingFacilityId?: string;
  programId?: string;
};
