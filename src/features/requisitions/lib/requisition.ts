export type RequisitionStatus =
  | 'INITIATED'
  | 'REJECTED'
  | 'SUBMITTED'
  | 'AUTHORIZED'
  | 'IN_APPROVAL'
  | 'APPROVED'
  | 'RELEASED'
  | 'RELEASED_WITHOUT_ORDER'
  | 'SKIPPED';

export type ColumnSource =
  | 'CALCULATED'
  | 'USER_INPUT'
  | 'STOCK_CARDS'
  | 'REFERENCE_DATA'
  | 'PREVIOUS_REQUISITION';

export type RequisitionColumn = {
  name: string;
  indicator?: string;
  label: string;
  definition?: string | null;
  displayOrder: number;
  isDisplayed: boolean;
  source: ColumnSource;
  option?: { optionName: string } | null;
  columnDefinition?: { columnType: string };
};

export type RequisitionTemplate = {
  id?: string;
  columnsMap: Readonly<Record<string, RequisitionColumn>>;
  patientsTabEnabled?: boolean;
  populateStockOnHandFromStockCards?: boolean;
  enableAvgConsumptionForCurrentPeriod?: boolean;
};

export type VersionIdentity = { id: string; versionNumber?: number };

export type RequisitionProgramEntry = {
  programId: string;
  fullSupply?: boolean;
  pricePerPack?: number | null;
  dosesPerPatient?: number | null;
  displayOrder?: number | null;
  orderableCategoryDisplayName?: string | null;
  orderableCategoryDisplayOrder?: number | null;
};

export type RequisitionProduct = {
  id: string;
  meta?: { versionNumber?: number };
  productCode: string;
  fullProductName: string | null;
  netContent?: number | null;
  packRoundingThreshold?: number | null;
  roundToZero?: boolean;
  dispensable?: { displayUnit?: string | null };
  programs?: readonly RequisitionProgramEntry[];
};

export type RequisitionApprovedProduct = {
  id: string;
  meta?: { versionNumber?: number };
  maxPeriodsOfStock?: number | null;
};

export type RequisitionReason = {
  reasonId: string;
  name?: string;
  reasonType: 'CREDIT' | 'DEBIT' | 'BALANCE_ADJUSTMENT';
  hidden?: boolean;
};

export type RequisitionLineItem = {
  id: string;
  orderable: VersionIdentity;
  approvedProduct?: VersionIdentity;
  skipped?: boolean;
  beginningBalance?: number | null;
  totalReceivedQuantity?: number | null;
  totalConsumedQuantity?: number | null;
  totalLossesAndAdjustments?: number | null;
  stockOnHand?: number | null;
  total?: number | null;
  totalStockoutDays?: number | null;
  additionalQuantityRequired?: number | null;
  adjustedConsumption?: number | null;
  previousAdjustedConsumptions?: readonly number[];
  averageConsumption?: number | null;
  maximumStockQuantity?: number | null;
  calculatedOrderQuantity?: number | null;
  idealStockAmount?: number | null;
  calculatedOrderQuantityIsa?: number | null;
  requestedQuantity?: number | null;
  requestedQuantityExplanation?: string | null;
  approvedQuantity?: number | null;
  remarks?: string | null;
  remarksForTBDispensedQuantity?: string | null;
  numberOfNewPatientsAdded?: number | null;
  packsToShip?: number | null;
  pricePerPack?: number | null;
  totalCost?: number | null;
  dosesPerPatient?: number | null;
  numberOfPatientsOnTreatmentNextMonth?: number | null;
  patientQuantitiesNotAvailable?: boolean;
  totalRequirement?: number | null;
  totalQuantityNeededByHf?: number | null;
  quantityToIssue?: number | null;
  convertedQuantityToIssue?: number | null;
  supplyingFacilityStockOnHand?: number | null;
  stockAdjustments?: readonly { reasonId: string; quantity: number }[];
};

export type RequisitionProgram = {
  id: string;
  name?: string;
  periodsSkippable?: boolean;
  showNonFullSupplyTab?: boolean;
  skipAuthorization?: boolean;
};

export type Requisition = {
  id?: string;
  status: RequisitionStatus;
  emergency: boolean;
  template: RequisitionTemplate;
  program: RequisitionProgram;
  requisitionLineItems: readonly RequisitionLineItem[];
  stockAdjustmentReasons?: readonly RequisitionReason[];
  patientsData?: string | null;
};
