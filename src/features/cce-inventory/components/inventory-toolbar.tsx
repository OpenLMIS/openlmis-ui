import { DownloadIcon, Loader2Icon, PlusIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { Button } from '@/components/ui/button';
import {
  CLEARED_INVENTORY_FILTERS,
  hasInventoryFilters,
  type InventorySearch,
} from '@/features/cce-inventory/lib/search';
import { EQUIPMENT_STATUS, EQUIPMENT_STATUSES } from '@/lib/cce-equipment-status';

type InventoryToolbarProps = {
  search: InventorySearch;
  onFilterChange: (patch: Partial<InventorySearch>) => void;
  view?: ReactNode;
  disabled?: boolean;
  exporting?: boolean;
  onExport?: () => void;
  onAdd?: () => void;
  adding?: boolean;
};

export function InventoryToolbar({
  search,
  onFilterChange,
  view,
  disabled = false,
  exporting = false,
  onExport,
  onAdd,
  adding = onAdd !== undefined,
}: InventoryToolbarProps) {
  const { t } = useTranslation();
  const statusOptions = EQUIPMENT_STATUSES.map((status) => ({
    value: status,
    label: t(EQUIPMENT_STATUS[status].labelKey),
  }));
  return (
    <DataTableToolbar>
      <div className="order-2 w-full @2xl/main:order-none @2xl/main:w-auto">
        <Button
          disabled={disabled || !onExport || exporting}
          focusableWhenDisabled={exporting}
          onClick={onExport}
          size="lg"
          variant="outline"
          width="full"
        >
          {exporting ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : (
            <DownloadIcon data-icon="inline-start" />
          )}
          {t('cce-inventory.export')}
        </Button>
      </div>
      <div className="flex-1 @2xl/main:flex-none">
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
      {view && <div className="@2xl/main:ms-auto">{view}</div>}
      {adding && (
        <div className="order-3 w-full @2xl/main:order-none @2xl/main:w-auto">
          <Button disabled={disabled || !onAdd} onClick={onAdd} size="lg" width="full">
            <PlusIcon data-icon="inline-start" />
            {t('cce-inventory.add')}
          </Button>
        </div>
      )}
    </DataTableToolbar>
  );
}
