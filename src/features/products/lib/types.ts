export type Product = {
  id: string;
  productCode: string;
  fullProductName: string | null;
  description: string | null;
  dispensable?: { displayUnit?: string | null; [key: string]: unknown };
};

export type ProductDetail = Product & {
  netContent: number;
  packRoundingThreshold: number;
  roundToZero: boolean;
  dispensable: { dispensingUnit?: string | null; sizeCode?: string | null; [key: string]: unknown };
  programs: ProgramLink[];
  children?: KitChild[];
  [key: string]: unknown;
};

export type KitChild = {
  orderable: { id: string; [key: string]: unknown };
  quantity: number | null;
};

export type ProgramLink = {
  programId: string;
  orderableDisplayCategoryId?: string | null;
  orderableCategoryDisplayName?: string | null;
  active?: boolean;
  fullSupply?: boolean;
  dosesPerPatient?: number | null;
  displayOrder?: number | null;
  pricePerPack?: number | null;
  [key: string]: unknown;
};

export type ProductsQuery = {
  page: number;
  size: number;
  sort: string;
  q?: string | undefined;
  program?: string | undefined;
};

export type CreateProductBody = {
  productCode: string;
  fullProductName?: string | undefined;
  description?: string | undefined;
  dispensable: { dispensingUnit: string };
  netContent: number;
  packRoundingThreshold: number;
  roundToZero: boolean;
};

export type ApprovalStock = {
  maxPeriodsOfStock: number;
  minPeriodsOfStock?: number | null;
  emergencyOrderPoint?: number | null;
};

export type Approval = ApprovalStock & {
  id: string;
  active: boolean;
  orderable: { id: string; [key: string]: unknown };
  program: { id: string; code: string; name: string | null; [key: string]: unknown };
  facilityType: { id: string; code: string; name: string; [key: string]: unknown };
  [key: string]: unknown;
};

export type NewApproval = {
  orderableId: string;
  facilityType: Pick<Approval['facilityType'], 'id' | 'code'>;
  program: Pick<Approval['program'], 'id' | 'code'>;
  stock: ApprovalStock;
};
