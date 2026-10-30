import type { HistoryState } from '@tanstack/react-router';
import { z } from 'zod';
import type { ApprovalSearch } from '@/features/requisitions/lib/approval-search';
import { requisitionSearchSchema } from '@/features/requisitions/lib/search-facilities';
import { facilityProgramSearchSchema } from '@/lib/facility-program-selection';

export const initiateSearchSchema = facilityProgramSearchSchema.extend({
  emergency: z.boolean().optional().catch(undefined),
});
export type InitiateSearch = z.infer<typeof initiateSearchSchema>;
export type RequisitionReturn =
  | { to: '/requisitions/initiate'; search: InitiateSearch }
  | { to: '/requisitions/approve'; search: ApprovalSearch };
export const approvalReturnState = (search: ApprovalSearch): HistoryState => ({
  requisitionReturn: { to: '/requisitions/approve', search },
});
export const requisitionReturnState = (search: InitiateSearch): HistoryState => ({
  requisitionReturn: { to: '/requisitions/initiate', search },
});
export const requisitionReturnTarget = (state: HistoryState, search: unknown) =>
  state.requisitionReturn ?? {
    to: '/requisitions/view' as const,
    search: requisitionSearchSchema.parse(search),
  };

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: router types extend by interface merging.
  interface HistoryState {
    requisitionReturn?: RequisitionReturn;
  }
}
