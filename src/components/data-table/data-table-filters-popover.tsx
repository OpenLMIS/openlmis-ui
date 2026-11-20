import { FilterIcon } from 'lucide-react';
import { createContext, type ReactNode, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDataTableLabels } from './data-table-labels';

export const DataTableFilterFlushContext = createContext<Set<() => void> | null>(null);

export const DataTableFilterResetContext = createContext<{
  resetters: Set<() => void>;
  setPending: (id: string, pending: boolean) => void;
} | null>(null);

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
  const [flushers] = useState(() => new Set<() => void>());
  const [hasPending, setHasPending] = useState(false);
  const [reset] = useState(() => {
    const pendingControls = new Set<string>();
    return {
      resetters: new Set<() => void>(),
      setPending(id: string, pending: boolean) {
        if (pending) pendingControls.add(id);
        else pendingControls.delete(id);
        setHasPending(pendingControls.size > 0);
      },
    };
  });
  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) for (const flush of flushers) flush();
      }}
    >
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
          <DataTableFilterFlushContext value={flushers}>
            <DataTableFilterResetContext value={reset}>{children}</DataTableFilterResetContext>
          </DataTableFilterFlushContext>
          <Button
            disabled={activeCount === 0 && !hasPending}
            focusableWhenDisabled
            onClick={() => {
              for (const discard of reset.resetters) discard();
              onClear();
            }}
            onMouseDown={(event) => {
              if (hasPending) event.preventDefault();
            }}
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
