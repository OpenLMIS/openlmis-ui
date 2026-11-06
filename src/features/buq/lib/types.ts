export type BuqStatus = 'DRAFT' | 'SUBMITTED' | 'REJECTED';

export type Buq = {
  id: string;
  facilityId: string;
  programId: string;
  processingPeriodId: string;
  targetYear: number;
  status: BuqStatus;
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

export type NamedRecord = { id: string; name: string };
