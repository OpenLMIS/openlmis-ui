export type NodeReference = { id: string; href?: string };

export type SupervisoryNode = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  facility?: NodeReference | null;
  parentNode?: NodeReference | null;
  partnerNodeOf?: NodeReference | null;
  requisitionGroup?: NodeReference | null;
  childNodes: NodeReference[];
  partnerNodes: NodeReference[];
  extraData?: Record<string, unknown> | null;
};

export type NodeRow = {
  id: string;
  code: string;
  name: string;
  facilityName: string | null;
  zoneName: string | null;
  childCount: number;
  partners: { id: string; name: string }[];
};

export type SupervisoryNodesQuery = {
  page: number;
  size: number;
  name?: string;
  zoneId?: string;
};
