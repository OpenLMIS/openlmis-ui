/** The id, code and name the API lists for every facility, enough to pick one. */
export type MinimalFacility = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export type Facility = {
  id: string;
  code: string;
  name: string | null;
  description?: string | null;
  active: boolean;
  enabled: boolean;
  goLiveDate?: string | null;
  goDownDate?: string | null;
  comment?: string | null;
  openLmisAccessible?: boolean | null;
  type: Pick<FacilityType, 'id' | 'code' | 'name'>;
  geographicZone: Pick<GeographicZone, 'id' | 'code' | 'name' | 'level'>;
  operator?: FacilityOperator | null;
  supportedPrograms?: SupportedProgram[];
  location?: unknown;
  extraData?: Record<string, string> | null;
};

/** A program on a facility; the flags are always sent, since a missing one saves as off. */
export type SupportedProgram = {
  id: string;
  code: string;
  name: string | null;
  supportActive: boolean;
  supportLocallyFulfilled: boolean;
  supportStartDate?: string | null;
};

export type GeographicZone = {
  id: string;
  code: string;
  name: string;
  level: { name: string | null; levelNumber?: number };
};

export type GeographicLevel = {
  id: string;
  code: string;
  name: string | null;
  levelNumber: number;
};

export type Organization = {
  id: string;
  name: string;
};

export type FacilityOperator = {
  id: string;
  code: string;
  name: string | null;
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
  /** How many users hold the role; only the list of all roles carries it. */
  count?: number;
};

export type Program = {
  id: string;
  code: string;
  name: string | null;
  description?: string | null;
  active: boolean | null;
  periodsSkippable?: boolean;
  skipAuthorization?: boolean;
  showNonFullSupplyTab?: boolean | null;
  enableDatePhysicalStockCountCompleted?: boolean;
};

/** The node's facility comes as a reference only; its name is in the facilities lookup. */
export type SupervisoryNode = {
  id: string;
  code: string;
  name: string;
  facility?: { id: string } | null;
};

export type FacilityType = {
  id: string;
  code: string;
  name: string | null;
  description?: string | null;
  displayOrder: number | null;
  active: boolean | null;
  primaryHealthCare: boolean | null;
};

export type OrderableDisplayCategory = {
  id: string;
  code: string;
  displayName: string;
  displayOrder: number;
};

/** Why stock moved; type and category stay plain strings, since the server may hold codes the UI doesn't name. */
export type Reason = {
  id: string;
  name: string;
  description?: string | null;
  reasonType: string;
  reasonCategory: string;
  isFreeTextAllowed: boolean;
  tags: string[];
};

/** A product as the lookups list it; `identifiers.tradeItem` ties it to its lots. */
export type Orderable = {
  id: string;
  productCode: string;
  fullProductName: string | null;
  description: string | null;
  dispensable?: { displayUnit?: string | null; [key: string]: unknown };
  /** How many dispensing units make a pack. */
  netContent?: number | null;
  identifiers?: Record<string, string>;
  extraData?: { useVVM?: string } | null;
  programs?: {
    programId: string;
    orderableDisplayCategoryId?: string | null;
    orderableCategoryDisplayName?: string | null;
  }[];
  meta?: { versionNumber?: number; [key: string]: unknown };
};

/** A lot as a lookup by id lists it, enough to name it beside a stock balance. */
export type LotSummary = {
  tradeItemId?: string;
  id: string;
  lotCode: string;
  expirationDate: string | null;
};

export type ValidReasonAssignment = {
  id?: string;
  program?: { id: string };
  facilityType?: { id: string };
  hidden: boolean;
  reason: Reason;
};

export type ValidReasonsFilter = { program: string; facilityType: string };

export type TradeItem = { id: string; gtin?: string | null };

export type OrderableFulfills = Record<
  string,
  { canFulfillForMe?: string[]; canBeFulfilledByMe?: string[] }
>;
