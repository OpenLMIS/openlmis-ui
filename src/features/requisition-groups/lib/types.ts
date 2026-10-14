export type RequisitionGroup = {
  id: string;
  code: string;
  name: string;
  description?: string;
  supervisoryNode: {
    id: string;
    code?: string;
    name: string;
    facility?: { id: string } | null;
  };
  requisitionGroupProgramSchedules: ProgramSchedule[];
  memberFacilities: MemberFacility[];
};

export type ProgramSchedule = {
  id?: string;
  program: { id: string; name?: string };
  processingSchedule: { id: string; code?: string; name?: string };
  directDelivery: boolean;
  dropOffFacility?: { id: string } | null;
};

export type MemberFacility = {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  type?: { name?: string };
  geographicZone?: { name?: string };
};

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
