import type { HistoryState } from '@tanstack/react-router';
import type { ApprovalSearch } from '@/features/requisitions/lib/approval-search';
import type { InitiateSearch } from '@/features/requisitions/lib/initiate-search';
import { requisitionSearchSchema } from '@/features/requisitions/lib/search-facilities';

export type RequisitionReturn =
  | { to: '/requisitions/initiate'; search: InitiateSearch }
  | { to: '/requisitions/approve'; search: ApprovalSearch };
export const returnState = (target: RequisitionReturn): HistoryState => ({
  requisitionReturn: target,
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
