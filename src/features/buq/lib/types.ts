export type BuqStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'AUTHORIZED'
  | 'IN_APPROVAL'
  | 'APPROVED'
  | 'APPROVED_BY_NQT'
  | 'REJECTED';

export type Buq = {
  id: string;
  facilityId: string;
  programId: string;
  processingPeriodId: string;
  targetYear: number;
  status: BuqStatus;
};

export type PreparedBuq = Buq & { bottomUpQuantificationLineItems?: readonly unknown[] };

export type TakenPeriod = { id: string; processingPeriodId: string };

export type BuqStatusChange = { status: BuqStatus; occurredDate: string };

export type BuqForApproval = Buq & { statusChanges: BuqStatusChange[] };

export type BuqApproveStats = {
  totalFacilities: number;
  totalSubmitted: number;
  percentageSubmitted: number;
};

export type BuqLineItem = {
  id: string;
  orderableId: string;
  annualAdjustedConsumption: number | null;
  verifiedAnnualAdjustedConsumption: number | null;
  forecastedDemand: number | null;
  totalCost: number | null;
  remark: { id: string } | null;
};

export type BuqSourceOfFundEntry = {
  sourceOfFund: { id: string; name?: string | null };
  amountUsedInLastFinancialYear: number | null;
  projectedFund: number | null;
};

export type BuqFundingDetails = {
  id?: string;
  totalProjectedFund?: number | null;
  totalForecastedCost?: number | null;
  gap?: number | null;
  sourcesOfFunds: BuqSourceOfFundEntry[];
};

export type BuqForecast = Buq & {
  bottomUpQuantificationLineItems: BuqLineItem[];
  fundingDetails: BuqFundingDetails | null;
};

export type BuqRejection = {
  rejectionReasons: string[];
  generalComments: string | null;
};

export type BuqPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type BuqPreparation = {
  facilityId: string;
  programId: string;
  processingPeriodId: string;
};

export type NamedItem = { id: string; name: string };
