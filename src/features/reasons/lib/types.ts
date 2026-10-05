import type { Reason } from '@/features/reference-data/lib/types';

export type ReasonBody = Omit<Reason, 'id'> & { id?: string };

/** Where a reason is offered; `hidden` keeps it assigned but out of the stock and requisition forms. */
export type ValidReason = {
  id: string;
  program: { id: string };
  facilityType: { id: string };
  hidden: boolean;
  reason: { id: string };
};

export type ValidReasonBody = Omit<ValidReason, 'id'>;
