import { InfoIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function RequisitionGridHeader({
  label,
  definition,
  align = 'start',
}: {
  label: string;
  definition?: string;
  align?: 'start' | 'center';
}) {
  const { t } = useTranslation();
  return (
    <div
      className={
        align === 'center'
          ? 'flex items-center justify-center gap-1 py-1.5'
          : 'flex items-center justify-between gap-1 py-1.5'
      }
    >
      <span
        className="min-w-(--label-width) text-balance whitespace-normal font-medium text-2xs text-muted-foreground uppercase tracking-table-label"
        style={{ '--label-width': `${Math.ceil(label.length / 3) + 1}ch` } as CSSProperties}
      >
        {label}
      </span>
      {definition && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t('requisitions.requisition.column-definition', { column: label })}
              />
            }
          >
            <InfoIcon />
          </TooltipTrigger>
          <TooltipContent>{definition}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
