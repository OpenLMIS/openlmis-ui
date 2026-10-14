import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
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
    return type ? facilityTypeName(type) : '';
  });
  if (names.length <= 1) return <span dir="auto">{names[0]}</span>;
  return (
    <Popover>
      <PopoverTrigger render={<Button size="sm" variant="link" />}>
        {t('requisition-templates.facility-type-count', { count: names.length })}
      </PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>
            {t('requisition-templates.facility-types-title', { template: template.name })}
          </PopoverTitle>
        </PopoverHeader>
        <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {names.map((name, index) =>
            name ? (
              <li dir="auto" key={template.facilityTypes[index].id}>
                {name}
              </li>
            ) : null,
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
