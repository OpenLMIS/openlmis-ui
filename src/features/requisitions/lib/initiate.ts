import type { InitiatePeriod } from '@/features/requisitions/lib/types';

export type InitiateRow = InitiatePeriod & {
  action: 'start' | 'open' | null;
  status: NonNullable<InitiatePeriod['requisitionStatus']> | 'not-started' | 'previous-pending';
};

export function initiateRows(
  periods: readonly InitiatePeriod[],
  emergency: boolean,
  canCreate: boolean,
  supportStartDate?: string | null,
): InitiateRow[] {
  return periods
    .filter((period) => emergency || !supportStartDate || period.startDate >= supportStartDate)
    .toSorted((a, b) => a.endDate.localeCompare(b.endDate))
    .map((period, index) => {
      const active = emergency || index === 0;
      return {
        ...period,
        action: active ? (period.requisitionId ? 'open' : canCreate ? 'start' : null) : null,
        status: period.requisitionStatus ?? (active ? 'not-started' : 'previous-pending'),
      };
    });
}
