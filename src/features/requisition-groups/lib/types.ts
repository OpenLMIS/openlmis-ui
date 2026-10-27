export type {
  MemberFacility,
  ProgramSchedule,
  RequisitionGroup,
} from '@/features/reference-data/lib/types';

export type RequisitionGroupBody = {
  id?: string;
  code: string;
  name: string;
  description?: string;
  supervisoryNode: { id: string };
  requisitionGroupProgramSchedules: {
    id?: string;
    program: { id: string };
    processingSchedule: { id: string };
    directDelivery: boolean;
    dropOffFacility?: { id: string };
  }[];
  memberFacilities: { id: string; code: string }[];
};

export type RequisitionGroupsSearch = { name?: string; zone?: string; program?: string };

export type RequisitionGroupsQuery = RequisitionGroupsSearch & { page: number; size: number };
