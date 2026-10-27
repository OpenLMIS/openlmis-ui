import type { RequisitionStatus } from '@/lib/requisition-status';

export type RequisitionSearchResult = {
  id: string;
  emergency: boolean;
  status: RequisitionStatus;
  createdDate?: string | null;
  program?: { name?: string | null } | null;
  facility?: { code?: string | null; name?: string | null } | null;
  processingPeriod?: {
    name?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
};

export type RequisitionsQuery = {
  facility: string;
  program?: string;
  requisitionStatus?: RequisitionStatus;
  initiatedDateFrom?: string;
  initiatedDateTo?: string;
  page: number;
  size: number;
  sort: string[];
};
