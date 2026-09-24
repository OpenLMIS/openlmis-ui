/** The id, code and name the API lists for every facility, enough to pick one. */
export type MinimalFacility = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

/** What a right is about; a role's rights all share one type, which is the role's type. */
export type RightType = 'SUPERVISION' | 'ORDER_FULFILLMENT' | 'REPORTS' | 'GENERAL_ADMIN';

export type Right = {
  id: string;
  name: string;
  type: RightType;
};

export type Role = {
  id: string;
  name: string;
  description?: string | null;
  rights: Right[];
};

export type Program = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

/** The node's facility comes as a reference only; its name is in the facilities lookup. */
export type SupervisoryNode = {
  id: string;
  code: string;
  name: string;
  facility?: { id: string } | null;
};
