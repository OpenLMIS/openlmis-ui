import { InfoIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            className="inline-flex cursor-help items-center gap-1 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            type="button"
          />
        }
      >
        {t('requisition-templates.facility-type-count', { count: names.length })}
        <InfoIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>
        <ul className="flex flex-col gap-0.5">
          {names.map((name, index) =>
            name ? (
              <li dir="auto" key={template.facilityTypes[index].id}>
                {name}
              </li>
            ) : null,
          )}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
