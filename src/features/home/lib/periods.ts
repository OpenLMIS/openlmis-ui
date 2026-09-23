import type { RequisitionStatus, RequisitionSummary } from '@/features/home/lib/types';

/** Sent on but not approved yet; drafts, rejections and skipped periods are left out. */
const IN_PROGRESS: ReadonlySet<RequisitionStatus> = new Set<RequisitionStatus>([
  'SUBMITTED',
  'AUTHORIZED',
  'IN_APPROVAL',
]);
const APPROVED: ReadonlySet<RequisitionStatus> = new Set<RequisitionStatus>([
  'APPROVED',
  'RELEASED',
  'RELEASED_WITHOUT_ORDER',
]);

export type PeriodTotals = {
  periodId: string;
  name: string;
  startDate: string;
  inProgress: number;
  approved: number;
};

/** The most recent periods that have requisitions in either group, oldest first, as a chart reads. */
export function totalsByPeriod(
  requisitions: readonly RequisitionSummary[],
  limit = 6,
): PeriodTotals[] {
  const periods = new Map<string, PeriodTotals>();

  for (const { status, processingPeriod } of requisitions) {
    const group = IN_PROGRESS.has(status) ? 'inProgress' : APPROVED.has(status) ? 'approved' : null;
    if (!group) continue;
    const totals = periods.get(processingPeriod.id) ?? {
      periodId: processingPeriod.id,
      name: processingPeriod.name,
      startDate: processingPeriod.startDate,
      inProgress: 0,
      approved: 0,
    };
    totals[group] += 1;
    periods.set(processingPeriod.id, totals);
  }

  return [...periods.values()].sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(-limit);
}
