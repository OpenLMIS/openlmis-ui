import { Link } from '@tanstack/react-router';
import { DownloadIcon, Loader2Icon, PlusIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CLEARED_INVENTORY_FILTERS,
  hasInventoryFilters,
  type InventorySearch,
} from '@/features/cce-inventory/lib/search';
import { EQUIPMENT_STATUS, EQUIPMENT_STATUSES } from '@/lib/cce-equipment-status';
import type { CompleteSelection } from '@/lib/facility-program-selection';

type InventoryToolbarProps = {
  search: InventorySearch;
  onFilterChange: (patch: Partial<InventorySearch>) => void;
  view?: ReactNode;
  disabled?: boolean;
  exporting?: boolean;
  onExport?: () => void;
  addTo?: CompleteSelection;
};

export function InventoryToolbar({
  search,
  onFilterChange,
  view,
  disabled = false,
  exporting = false,
  onExport,
  addTo,
}: InventoryToolbarProps) {
  const { t } = useTranslation();
  const statusOptions = EQUIPMENT_STATUSES.map((status) => ({
    value: status,
    label: t(EQUIPMENT_STATUS[status].labelKey),
  }));
  return (
    <DataTableToolbar>
      <div className="flex-1 @2xl/main:me-auto @2xl/main:flex-none">
        <DataTableFilters
          activeCount={Number(hasInventoryFilters(search))}
          disabled={disabled}
          onClear={() => onFilterChange(CLEARED_INVENTORY_FILTERS)}
          size="lg"
        >
          <DataTableSelectFilter
            label={t('cce-inventory.functional-status')}
            onValueChange={(value) =>
              onFilterChange({
                functionalStatus: EQUIPMENT_STATUSES.find((status) => status === value),
                page: undefined,
              })
            }
            options={statusOptions}
            value={search.functionalStatus ?? ''}
          />
        </DataTableFilters>
      </div>
      {view}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              disabled={disabled || !onExport || exporting}
              focusableWhenDisabled={exporting}
              onClick={onExport}
              size="lg"
              variant="outline"
            />
          }
        >
          {exporting ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : (
            <DownloadIcon data-icon="inline-start" />
          )}
          {t('cce-inventory.export')}
        </TooltipTrigger>
        <TooltipContent>{t('cce-inventory.export-hint')}</TooltipContent>
      </Tooltip>
      {addTo && (
        <Button
          nativeButton={false}
          role="link"
          render={
            <Link search={addTo} state={{ inventoryListSearch: search }} to="/cce/inventory/new" />
          }
          size="lg"
        >
          <PlusIcon data-icon="inline-start" />
          {t('cce-inventory.add')}
        </Button>
      )}
    </DataTableToolbar>
  );
}
