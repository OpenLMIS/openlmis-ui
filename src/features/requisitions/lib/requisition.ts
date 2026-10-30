import type { ApprovedProduct, Orderable } from '@/features/reference-data/lib/types';
import type { RequisitionStatus } from '@/lib/requisition-status';
import type { RequisitionColumn } from '@/lib/requisition-template';

export type RequisitionTemplate = {
  id?: string;
  columnsMap: Readonly<Record<string, RequisitionColumn>>;
  patientsTabEnabled?: boolean;
  rejectionReasonWindowVisible?: boolean;
  populateStockOnHandFromStockCards?: boolean;
  enableAvgConsumptionForCurrentPeriod?: boolean;
};

export type VersionIdentity = { id: string; versionNumber?: number };

export type RequisitionProgramEntry = NonNullable<Orderable['programs']>[number];

export type RequisitionProduct = Pick<
  Orderable,
  | 'id'
  | 'meta'
  | 'productCode'
  | 'fullProductName'
  | 'netContent'
  | 'packRoundingThreshold'
  | 'roundToZero'
  | 'dispensable'
  | 'programs'
>;

export type RequisitionApprovedProduct = Pick<ApprovedProduct, 'id' | 'meta' | 'maxPeriodsOfStock'>;

export type RequisitionReason = {
  id: string;
  description?: string;
  isFreeTextAllowed?: boolean;
  reasonCategory?: string;
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
