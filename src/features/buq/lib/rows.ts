import type { Buq, BuqPeriod } from '@/features/buq/lib/types';

export type BuqRow = Buq & { periodName: string };

export function buqRows(buqs: readonly Buq[], periods: readonly BuqPeriod[]): BuqRow[] {
  const byId = new Map(periods.map((period) => [period.id, period]));
  return buqs
    .map((buq) => ({ ...buq, period: byId.get(buq.processingPeriodId) }))
    .toSorted(
      (a, b) =>
        a.targetYear - b.targetYear ||
        (a.period?.startDate ?? '').localeCompare(b.period?.startDate ?? ''),
    )
    .map(({ period, ...buq }) => ({ ...buq, periodName: period?.name ?? String(buq.targetYear) }));
}

export function quantificationYears(targetYear: number) {
  return `${targetYear + 1}/${targetYear + 2}`;
}
