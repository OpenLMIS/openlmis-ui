import { useTranslation } from 'react-i18next';
import { NamesPopover } from '@/components/names-popover';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import type { FacilityType } from '@/features/reference-data/lib/types';
import type { RequisitionTemplate } from '@/features/requisition-templates/lib/types';

export function FacilityTypesCell({
  template,
  types,
}: {
  template: RequisitionTemplate;
  types: readonly FacilityType[];
}) {
  const { t } = useTranslation();
  const names = template.facilityTypes.map(({ id }) => {
    const type = types.find((type) => type.id === id);
    return { id, name: type ? facilityTypeName(type) : '' };
  });
  if (names.length <= 1) return <span dir="auto">{names[0]?.name}</span>;
  return (
    <NamesPopover
      names={names.filter(({ name }) => name)}
      summary={t('requisition-templates.facility-type-count', { count: names.length })}
    />
  );
}
