import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import type { FacilityType } from '@/features/reference-data/lib/types';
import type { RequisitionTemplate } from '@/features/requisition-templates/lib/types';

type Assignment = Pick<
  RequisitionTemplate,
  'id' | 'program' | 'facilityTypes' | 'requisitionReportOnly'
>;

function availableTypes(
  types: readonly FacilityType[],
  templates: readonly Assignment[],
  selected: readonly string[],
) {
  const used = new Set([
    ...selected,
    ...templates.flatMap((template) => template.facilityTypes.map(({ id }) => id)),
  ]);
  return types
    .filter((type) => type.active && !used.has(type.id))
    .sort((a, b) => facilityTypeName(a).localeCompare(facilityTypeName(b)));
}

export function eligibleForNewTemplate(
  types: readonly FacilityType[],
  templates: readonly Assignment[],
  programId: string | null,
  reportOnly: boolean,
  selected: readonly string[],
) {
  if (!programId) return [];
  return availableTypes(
    types,
    templates.filter(
      (template) =>
        template.program?.id === programId && (!reportOnly || template.requisitionReportOnly),
    ),
    selected,
  );
}

export function eligibleForTemplate(
  types: readonly FacilityType[],
  templates: readonly Assignment[],
  programId: string,
  templateId: string,
  selected: readonly string[],
) {
  return availableTypes(
    types,
    templates.filter(
      (template) => template.id !== templateId && template.program?.id === programId,
    ),
    selected,
  );
}
