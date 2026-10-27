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
