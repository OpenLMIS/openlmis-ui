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

/** The parts of a requisition the dashboard shows. */
export type RequisitionSummary = {
  id: string;
  emergency: boolean;
  status: RequisitionStatus;
  createdDate: string;
  program: { name: string };
  facility: { code: string; name: string };
  processingPeriod: { name: string; startDate: string };
  statusChanges?: Partial<Record<RequisitionStatus, { changeDate: string }>>;
};

export type EquipmentStatus =
  | 'FUNCTIONING'
  | 'NEEDS_ATTENTION'
  | 'AWAITING_REPAIR'
  | 'UNSERVICEABLE';

export type SystemNotification = {
  id: string;
  title: string | null;
  message: string;
};

/** What the signed-in user's rights let the dashboard show; the route works it out from their rights. */
export type DashboardAccess = {
  approve: boolean;
  convert: boolean;
  orders: boolean;
  equipment: boolean;
  requisitions: boolean;
};
