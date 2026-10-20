import { FilterIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDataTableLabels } from './data-table-labels';

type DataTableFiltersProps = {
  activeCount: number;
  onClear: () => void;
  disabled?: boolean;
  children?: ReactNode;
  size?: 'default' | 'lg';
};

export function DataTableFilters({
  activeCount,
  onClear,
  disabled = false,
  children,
  size = 'default',
}: DataTableFiltersProps) {
  const labels = useDataTableLabels();
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button disabled={disabled} size={size} type="button" variant="outline" width="full" />
        }
      >
        <FilterIcon data-icon="inline-start" />
        {labels.filters}
        {activeCount > 0 && (
          <>
            <Badge aria-hidden variant="secondary">
              {activeCount.toLocaleString()}
            </Badge>
            <span className="sr-only">{labels.activeFilters(activeCount)}</span>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" aria-label={labels.filters} side="bottom" width="wide">
        <div className="flex flex-col gap-3">
          {children}
          <Button
            disabled={activeCount === 0}
            focusableWhenDisabled
            onClick={onClear}
            type="button"
            variant="destructive"
            width="full"
          >
            {labels.clearFilters}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
