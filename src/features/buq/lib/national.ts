import type { BuqStatus, FinalApprovalItem, SupervisedZones } from '@/features/buq/lib/types';
import type { Facility, GeographicZone } from '@/features/reference-data/lib/types';

type NamedZone = Pick<GeographicZone, 'id' | 'name' | 'level'>;

type NationalFacility = Pick<Facility, 'id' | 'name' | 'type'>;

export type CostGroupId = 'pharmaceuticals' | 'medical' | 'radiology' | 'diagnostics' | 'dental';

export const COST_GROUP_IDS: readonly CostGroupId[] = [
  'pharmaceuticals',
  'medical',
  'radiology',
  'diagnostics',
  'dental',
];

const GROUP_NAMES: Record<CostGroupId, string> = {
  pharmaceuticals: 'Pharmaceuticals',
  medical: 'Medical supplies',
  radiology: 'Radiology (X-rays consumables)',
  diagnostics: 'Diagnostics supplies',
  dental: 'Dental supplies',
};

export type GroupOption = { value: string; label: string };

export type NationalRow = {
  id: string;
  facilityName: string;
  facilityType: string;
  status: BuqStatus;
  costs: Record<CostGroupId, number | null>;
};

export type CostTotals = Record<CostGroupId | 'others', number>;

const byGroup = <T>(value: (id: CostGroupId) => T): Record<CostGroupId, T> => ({
  pharmaceuticals: value('pharmaceuticals'),
  medical: value('medical'),
  radiology: value('radiology'),
  diagnostics: value('diagnostics'),
  dental: value('dental'),
});

export function groupOptions(tree: SupervisedZones, zones: readonly NamedZone[]): GroupOption[] {
  const byId = new Map(zones.map((zone) => [zone.id, zone]));
  const sorted = (ids: string[]) =>
    ids
      .map((id) => {
        const zone = byId.get(id);
        const level = zone?.level.name;
        return {
          value: id,
          name: zone?.name ?? id,
          label: level ? `${zone?.name} (${level})` : id,
        };
      })
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map(({ value, label }) => ({ value, label }));
  return sorted(Object.keys(tree)).flatMap((country) => {
    const zonesOf = tree[country.value] ?? {};
    return [
      country,
      ...sorted(Object.keys(zonesOf)).flatMap((zone) => [
        zone,
        ...sorted(Object.keys(zonesOf[zone.value] ?? {})),
      ]),
    ];
  });
}

function parseCost(text: string | undefined) {
  const amount = text?.match(/^\s*(-?\d+(?:\.\d+)?)/)?.[1];
  return amount == null ? null : Number(amount);
}

export function nationalRows(
  items: readonly FinalApprovalItem[],
  facilities: readonly NationalFacility[],
): NationalRow[] {
  const byId = new Map(facilities.map((facility) => [facility.id, facility]));
  return items.map(({ bottomUpQuantification: buq, calculatedGroupsCosts }) => {
    const facility = byId.get(buq.facilityId);
    return {
      id: buq.id,
      facilityName: facility?.name ?? '',
      facilityType: facility?.type.name ?? '',
      status: buq.status,
      costs: byGroup((id) => parseCost(calculatedGroupsCosts[GROUP_NAMES[id]])),
    };
  });
}

export const nationalFacilityIds = (items: readonly FinalApprovalItem[]) =>
  [
    ...new Set(items.map(({ bottomUpQuantification }) => bottomUpQuantification.facilityId)),
  ].toSorted();

export function costTotals(items: readonly FinalApprovalItem[]): CostTotals {
  const named = new Map(COST_GROUP_IDS.map((id) => [GROUP_NAMES[id], id]));
  const cents = new Map<CostGroupId | 'others', number>();
  for (const { calculatedGroupsCosts } of items) {
    for (const [name, text] of Object.entries(calculatedGroupsCosts)) {
      const id = named.get(name) ?? 'others';
      cents.set(id, (cents.get(id) ?? 0) + Math.round((parseCost(text) ?? 0) * 100));
    }
  }
  const total = (id: CostGroupId | 'others') => (cents.get(id) ?? 0) / 100;
  return { ...byGroup(total), others: total('others') };
}
