import type { Requisition, RequisitionLineItem } from '@/features/requisitions/lib/requisition';
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

export type RequisitionRecord = Omit<Requisition, 'requisitionLineItems'> & {
  requisitionLineItems: readonly (RequisitionLineItem & {
    orderable: { id: string; versionNumber: number };
    approvedProduct?: { id: string; versionNumber: number };
  })[];
  id: string;
  facility: { id: string };
  processingPeriod: { id: string };
  supervisoryNode?: { id: string } | null;
  reportOnly?: boolean;
  datePhysicalStockCountCompleted?: string | null;
  extraData?: { originalRequisition?: string } | null;
  supplyingFacilities?: { id: string; name?: string }[];
  supplyingFacilityAccessDenied?: boolean;
  statusHistory?: {
    status: RequisitionStatus;
    createdDate: string;
    rejections?: {
      id: string;
      rejectionReason: { name?: string; rejectionReasonCategory?: { name?: string } };
    }[];
  }[];
};
export type RequisitionStatusMessage = {
  id?: string;
  status: RequisitionStatus;
  body?: string | null;
  createdDate: string;
  authorFirstName?: string | null;
  authorLastName?: string | null;
};
