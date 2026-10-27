import {
  BanIcon,
  CheckCheckIcon,
  CheckIcon,
  CircleCheckIcon,
  ClockIcon,
  FilePenIcon,
  SendIcon,
  TruckIcon,
  XIcon,
} from 'lucide-react';

export const REQUISITION_STATUSES = [
  'INITIATED',
  'REJECTED',
  'SUBMITTED',
  'AUTHORIZED',
  'IN_APPROVAL',
  'APPROVED',
  'RELEASED',
  'RELEASED_WITHOUT_ORDER',
  'SKIPPED',
] as const;
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

export const REQUISITION_STATUS = {
  INITIATED: { labelKey: 'requisitions.status.initiated', tone: 'secondary', icon: FilePenIcon },
  REJECTED: { labelKey: 'requisitions.status.rejected', tone: 'destructive', icon: XIcon },
  SUBMITTED: { labelKey: 'requisitions.status.submitted', tone: 'info', icon: SendIcon },
  AUTHORIZED: { labelKey: 'requisitions.status.authorized', tone: 'info', icon: CheckIcon },
  IN_APPROVAL: { labelKey: 'requisitions.status.in-approval', tone: 'warning', icon: ClockIcon },
  APPROVED: { labelKey: 'requisitions.status.approved', tone: 'success', icon: CircleCheckIcon },
  RELEASED: { labelKey: 'requisitions.status.released', tone: 'success', icon: TruckIcon },
  RELEASED_WITHOUT_ORDER: {
    labelKey: 'requisitions.status.released-without-order',
    tone: 'success',
    icon: CheckCheckIcon,
  },
  SKIPPED: { labelKey: 'requisitions.status.skipped', tone: 'secondary', icon: BanIcon },
} as const;
