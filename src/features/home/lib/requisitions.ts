import type { RequisitionSummary } from '@/features/home/lib/types';

/** When the requisition reached its current approver: the latest step it took towards them. */
export function waitingSince({ statusChanges, createdDate }: RequisitionSummary): string {
  return (
    statusChanges?.IN_APPROVAL?.changeDate ??
    statusChanges?.AUTHORIZED?.changeDate ??
    statusChanges?.SUBMITTED?.changeDate ??
    createdDate
  );
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
