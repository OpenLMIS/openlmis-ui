import { regionOf } from '@/features/buq/lib/region';
import type { BuqForApproval, BuqPeriod, BuqStatusChange } from '@/features/buq/lib/types';
import type { Facility } from '@/features/reference-data/lib/types';

type ApprovalFacility = Pick<Facility, 'id' | 'code' | 'name' | 'type' | 'geographicZone'>;

export type ApprovalRow = {
  id: string;
  facilityCode: string;
  facilityName: string;
  facilityType: string;
  district: string;
  region: string;
  periodName: string;
  submittedAt: string;
};

const time = (value: string) => Date.parse(value) || 0;

export const approvalFacilityIds = (buqs: readonly BuqForApproval[]) =>
  [...new Set(buqs.map(({ facilityId }) => facilityId))].toSorted();

function lastAuthorized(changes: readonly BuqStatusChange[]) {
  return changes
    .filter(({ status }) => status === 'AUTHORIZED')
    .reduce(
      (latest, { occurredDate }) => (time(occurredDate) > time(latest) ? occurredDate : latest),
      '',
    );
}

export function approvalRows(
  buqs: readonly BuqForApproval[],
  facilities: readonly ApprovalFacility[],
  periods: readonly Pick<BuqPeriod, 'id' | 'name'>[],
): ApprovalRow[] {
  const facilityById = new Map(facilities.map((facility) => [facility.id, facility]));
  const periodById = new Map(periods.map((period) => [period.id, period.name]));
  return buqs
    .map((buq) => {
      const facility = facilityById.get(buq.facilityId);
      return {
        id: buq.id,
        facilityCode: facility?.code ?? '',
        facilityName: facility?.name ?? '',
        facilityType: facility?.type.name ?? '',
        district: facility?.geographicZone.name ?? '',
        region: regionOf(facility?.geographicZone),
        periodName: periodById.get(buq.processingPeriodId) ?? String(buq.targetYear),
        submittedAt: lastAuthorized(buq.statusChanges),
      };
    })
    .toSorted(
      (a, b) =>
        time(a.submittedAt) - time(b.submittedAt) || a.facilityName.localeCompare(b.facilityName),
    );
}
